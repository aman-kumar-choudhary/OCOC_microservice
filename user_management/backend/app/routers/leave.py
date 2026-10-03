"""Leave management API mounted in the user-management process and database."""
from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import Claims, get_current_claims, require_permission, resolve_warden_hostel_scope, ADMIN_ROLES

router = APIRouter(prefix="/api/v1/leave", tags=["leave_management"])
STAGE_PERMISSIONS = {"leave.approve.warden", "leave.approve.chancellor", "leave.approve.medical"}
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_DOCUMENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}

class LeaveInput(BaseModel):
    leave_type_id: uuid.UUID
    start_at: datetime
    end_at: datetime
    destination: str = Field(min_length=1, max_length=300)
    reason: str = Field(min_length=1, max_length=4000)
    custom_reason: Optional[str] = Field(default=None, max_length=1000)
    contact_info: dict[str, Any] = Field(default_factory=dict)


class DecisionInput(BaseModel):
    comment: str = Field(default="", max_length=2000)


class WorkflowInput(BaseModel):
    workflow: list[str]


class LeaveTypeInput(BaseModel):
    code: str = Field(min_length=2, max_length=40, pattern=r"^[A-Z0-9_]+$")
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=1000)
    workflow: list[str]


class BalanceInput(BaseModel):
    student_id: uuid.UUID
    leave_type_id: uuid.UUID
    academic_period: str = Field(min_length=4, max_length=30)
    allowed_days: float = Field(ge=0)
    allow_negative: bool = False


class DelegationInput(BaseModel):
    delegate_id: uuid.UUID
    permission: str
    starts_at: datetime
    ends_at: datetime
    reason: str = Field(min_length=1, max_length=1000)


async def local_user(conn: asyncpg.Connection, claims: Claims) -> uuid.UUID:
    value = await conn.fetchval(
        "SELECT id FROM users WHERE keycloak_user_id=$1 OR (email IS NOT NULL AND LOWER(email)=LOWER($2)) ORDER BY CASE WHEN keycloak_user_id=$1 THEN 0 ELSE 1 END LIMIT 1",
        str(claims.sub),
        str(claims.email or claims.preferred_username or ""),
    )
    if not value:
        raise HTTPException(403, "No local user is linked to this account")
    return value


def response(data: Any = None, message: str = "") -> dict[str, Any]:
    return {"success": True, "data": data, "message": message}


def json_value(value):
    return json.loads(value) if isinstance(value, str) else value


async def audit(conn, request_id, student_id, actor_id, action, old, new, comment="", permission=None, metadata=None):
    await conn.execute(
        """INSERT INTO leave_audit_logs(request_id,student_id,actor_id,actor_permission,action,previous_state,new_state,comments,metadata)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)""",
        request_id, student_id, actor_id, permission, action, old, new, comment,
        json.dumps(metadata or {}),
    )


async def notify_permission(conn, request_id, permission, event):
    role = {"leave.approve.warden": "WARDEN", "leave.approve.chancellor": "CHANCELLOR", "leave.approve.medical": "MEDICAL_OFFICER"}.get(permission)
    if not role:
        return
    await conn.execute("""INSERT INTO leave_notifications(request_id,recipient_id,permission,event)
        SELECT $1,ur.user_id,$2,$3 FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id
        WHERE upper(ro.name)=$4 ON CONFLICT DO NOTHING""", request_id, permission, event, role)


async def load_request(conn, request_id: uuid.UUID):
    row = await conn.fetchrow("""
        SELECT r.*, t.name AS leave_type, t.code AS leave_type_code,
               COALESCE(sp.full_name, u.email) AS student_name,
               sp.roll_number, sp.room_number, sp.course, sp.semester,
               h.name AS hostel_name, u.email AS student_email, u.phone AS student_phone
        FROM leave_requests r
        JOIN leave_types t ON t.id=r.leave_type_id
        LEFT JOIN student_profiles sp ON sp.user_id=r.student_id
        LEFT JOIN hostels h ON h.id=sp.hostel_id
        LEFT JOIN users u ON u.id=r.student_id
        WHERE r.id=$1
    """, request_id)
    if not row:
        raise HTTPException(404, "Leave request not found")
    return dict(row)


def can_approve(claims: Claims, permission: str) -> bool:
    return claims.has_any_role("SUPER_ADMIN", "ADMIN") or claims.has_any_role(*{
        "leave.approve.warden": ["WARDEN", "ADMIN"],
        "leave.approve.chancellor": ["CHANCELLOR"],
        "leave.approve.medical": ["MEDICAL_OFFICER"],
    }.get(permission, []))


@router.get("/types")
async def list_types(conn=Depends(get_db), claims: Claims = Depends(get_current_claims)):
    rows = await conn.fetch("SELECT id,code,name,description,enabled,workflow FROM leave_types WHERE enabled ORDER BY name")
    return response([dict(r) for r in rows])


@router.post("/types")
async def create_type(body: LeaveTypeInput, conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.workflow.manage"))):
    if not body.workflow or any(p not in STAGE_PERMISSIONS for p in body.workflow):
        raise HTTPException(400, "Workflow must contain valid approval permission stages")
    row = await conn.fetchrow("INSERT INTO leave_types(code,name,description,workflow) VALUES($1,$2,$3,$4::jsonb) RETURNING *", body.code, body.name, body.description, json.dumps(body.workflow))
    return response(dict(row), "Leave type created")


@router.patch("/types/{type_id}")
async def update_type(type_id: uuid.UUID, body: LeaveTypeInput, conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.workflow.manage"))):
    if not body.workflow or any(p not in STAGE_PERMISSIONS for p in body.workflow):
        raise HTTPException(400, "Workflow must contain valid approval permission stages")
    row = await conn.fetchrow("UPDATE leave_types SET code=$2,name=$3,description=$4,workflow=$5::jsonb,updated_at=now() WHERE id=$1 RETURNING *", type_id, body.code, body.name, body.description, json.dumps(body.workflow))
    if not row: raise HTTPException(404, "Leave type not found")
    return response(dict(row), "Leave type updated")


@router.post("/requests")
async def create_request(body: LeaveInput, draft: bool = Query(True), conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.request.submit"))):
    if body.end_at <= body.start_at:
        raise HTTPException(400, "End time must be after start time")
    if body.start_at.tzinfo is None or body.end_at.tzinfo is None:
        raise HTTPException(400, "Start and end times must include a timezone")
    actor = await local_user(conn, claims)
    leave_type = await conn.fetchrow("SELECT id,code,workflow FROM leave_types WHERE id=$1 AND enabled", body.leave_type_id)
    if not leave_type:
        raise HTTPException(400, "Leave type is unavailable")
    async with conn.transaction():
        conflict = await conn.fetchval("""SELECT EXISTS(SELECT 1 FROM leave_requests WHERE student_id=$1
          AND status IN ('SUBMITTED','PENDING_APPROVAL','APPROVED') AND tstzrange(start_at,end_at,'[)') && tstzrange($2,$3,'[)'))""", actor, body.start_at, body.end_at)
        if conflict:
            raise HTTPException(409, "This period overlaps another active leave request")
        status = "DRAFT" if draft else "SUBMITTED"
        row = await conn.fetchrow("""INSERT INTO leave_requests(student_id,leave_type_id,start_at,end_at,destination,reason,custom_reason,contact_info,status,workflow_snapshot,submitted_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,CASE WHEN $9='DRAFT' THEN NULL ELSE now() END) RETURNING *""",
          actor, body.leave_type_id, body.start_at, body.end_at, body.destination, body.reason, body.custom_reason,
          json.dumps(body.contact_info), status, json.dumps(json_value(leave_type["workflow"])))
        if not draft:
            await conn.execute("UPDATE leave_requests SET status='PENDING_APPROVAL' WHERE id=$1", row["id"])
            workflow = json_value(leave_type["workflow"])
            await notify_permission(conn, row["id"], workflow[0] if workflow else None, "APPROVAL_REQUIRED")
            if leave_type["code"] == "EMERGENCY":
                await notify_permission(conn, row["id"], "leave.approve.chancellor", "EMERGENCY_AWARENESS")
            await conn.execute("INSERT INTO leave_notifications(request_id,recipient_id,event) VALUES($1,$2,'SUBMITTED')", row["id"], actor)
        await audit(conn, row["id"], actor, actor, "CREATED", None, status)
        if not draft:
            await audit(conn, row["id"], actor, actor, "SUBMITTED", "SUBMITTED", "PENDING_APPROVAL")
    return response(await load_request(conn, row["id"]), "Draft saved" if draft else "Leave submitted")


@router.get("/requests")
async def list_requests(conn=Depends(get_db), claims: Claims = Depends(get_current_claims), status_filter: Optional[str] = Query(None, alias="status"), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    actor = await local_user(conn, claims)
    base_select = """
        SELECT r.*, t.name AS leave_type, t.code AS leave_type_code,
               COALESCE(sp.full_name, u.email) AS student_name,
               sp.roll_number, sp.room_number, sp.course, sp.semester,
               h.name AS hostel_name, u.email AS student_email, u.phone AS student_phone
        FROM leave_requests r
        JOIN leave_types t ON t.id=r.leave_type_id
        LEFT JOIN student_profiles sp ON sp.user_id=r.student_id
        LEFT JOIN hostels h ON h.id=sp.hostel_id
        LEFT JOIN users u ON u.id=r.student_id
    """
    if claims.has_any_role("SUPER_ADMIN", "ADMIN"):
        rows = await conn.fetch(f"""{base_select}
          WHERE ($1::text IS NULL OR r.status=$1) ORDER BY r.created_at DESC LIMIT $2 OFFSET $3""", status_filter, limit, offset)
    elif claims.has_any_role("WARDEN"):
        warden_hostels = await resolve_warden_hostel_scope(conn, claims)
        if not warden_hostels:
            rows = []
        else:
            rows = await conn.fetch(f"""{base_select}
              WHERE sp.hostel_id = ANY($1::uuid[]) AND ($2::text IS NULL OR r.status=$2)
              ORDER BY r.created_at DESC LIMIT $3 OFFSET $4""", warden_hostels, status_filter, limit, offset)
    elif any(can_approve(claims, permission) for permission in STAGE_PERMISSIONS):
        permissions = [permission for permission in STAGE_PERMISSIONS if can_approve(claims, permission)]
        rows = await conn.fetch(f"""{base_select}
          WHERE ((r.status='PENDING_APPROVAL' AND r.workflow_snapshot->>r.current_stage = ANY($1::text[])) OR EXISTS(SELECT 1 FROM leave_approvals a WHERE a.request_id=r.id AND a.actor_id=$2))
            AND ($3::text IS NULL OR r.status=$3) ORDER BY r.created_at DESC LIMIT $4 OFFSET $5""", permissions, actor, status_filter, limit, offset)
    else:
        rows = await conn.fetch(f"""{base_select}
          WHERE r.student_id=$1 AND ($2::text IS NULL OR r.status=$2) ORDER BY r.created_at DESC LIMIT $3 OFFSET $4""", actor, status_filter, limit, offset)
    return {"success": True, "data": [dict(r) for r in rows], "pagination": {"limit": limit, "offset": offset}}


async def accessible_request(conn, claims, request_id):
    item = await load_request(conn, request_id)
    item["workflow_snapshot"] = json_value(item["workflow_snapshot"])
    actor = await local_user(conn, claims)
    stage = item["workflow_snapshot"][item["current_stage"]] if item["status"] == "PENDING_APPROVAL" and item["current_stage"] < len(item["workflow_snapshot"]) else None
    prior_approver = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM leave_approvals WHERE request_id=$1 AND actor_id=$2)", request_id, actor)
    if item["student_id"] != actor and not (stage and can_approve(claims, stage)) and not prior_approver and not claims.has_any_role("SUPER_ADMIN", "ADMIN"):
        raise HTTPException(403, "You cannot access this leave request")
    return item, actor


@router.get("/requests/{request_id}")
async def request_detail(request_id: uuid.UUID, conn=Depends(get_db), claims: Claims = Depends(get_current_claims)):
    item, _ = await accessible_request(conn, claims, request_id)
    history = await conn.fetch("SELECT stage_index,permission,decision,comment,decided_at FROM leave_approvals WHERE request_id=$1 ORDER BY stage_index", request_id)
    docs = await conn.fetch("SELECT id,filename,content_type,created_at FROM leave_documents WHERE request_id=$1", request_id)
    item["approval_history"] = [dict(r) for r in history]
    item["documents"] = [dict(r) for r in docs]
    return response(item)


@router.put("/requests/{request_id}")
async def update_draft(request_id: uuid.UUID, body: LeaveInput, conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.request.submit"))):
    actor = await local_user(conn, claims)
    async with conn.transaction():
        row = await conn.fetchrow("SELECT * FROM leave_requests WHERE id=$1 FOR UPDATE", request_id)
        if not row or row["student_id"] != actor: raise HTTPException(404, "Draft not found")
        if row["status"] != "DRAFT": raise HTTPException(409, "Only drafts can be edited")
        if body.end_at <= body.start_at: raise HTTPException(400, "End time must be after start time")
        await conn.execute("""UPDATE leave_requests SET leave_type_id=$2,start_at=$3,end_at=$4,destination=$5,reason=$6,custom_reason=$7,contact_info=$8::jsonb,updated_at=now() WHERE id=$1""",
            request_id, body.leave_type_id, body.start_at, body.end_at, body.destination, body.reason, body.custom_reason, json.dumps(body.contact_info))
        await audit(conn, request_id, actor, actor, "UPDATED", "DRAFT", "DRAFT")
    return response(await load_request(conn, request_id), "Draft updated")


@router.post("/requests/{request_id}/submit")
async def submit_request(request_id: uuid.UUID, conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.request.submit"))):
    actor = await local_user(conn, claims)
    async with conn.transaction():
        row = await conn.fetchrow("SELECT * FROM leave_requests WHERE id=$1 FOR UPDATE", request_id)
        if not row or row["student_id"] != actor: raise HTTPException(404, "Draft not found")
        if row["status"] != "DRAFT": raise HTTPException(409, "Request is not a draft")
        collision = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM leave_requests WHERE student_id=$1 AND id<>$2 AND status IN ('SUBMITTED','PENDING_APPROVAL','APPROVED') AND tstzrange(start_at,end_at,'[)') && tstzrange($3,$4,'[)'))", actor, request_id, row["start_at"], row["end_at"])
        if collision: raise HTTPException(409, "This period overlaps another active leave request")
        await conn.execute("UPDATE leave_requests SET status='SUBMITTED',submitted_at=now(),updated_at=now() WHERE id=$1", request_id)
        await conn.execute("UPDATE leave_requests SET status='PENDING_APPROVAL',updated_at=now() WHERE id=$1", request_id)
        flow = json_value(row["workflow_snapshot"])
        permission = flow[0] if flow else None
        await notify_permission(conn, request_id, permission, "APPROVAL_REQUIRED")
        if row["leave_type_id"] and await conn.fetchval("SELECT code='EMERGENCY' FROM leave_types WHERE id=$1", row["leave_type_id"]):
            await notify_permission(conn, request_id, "leave.approve.chancellor", "EMERGENCY_AWARENESS")
        await conn.execute("INSERT INTO leave_notifications(request_id,recipient_id,event) VALUES($1,$2,'SUBMITTED')", request_id, actor)
        await audit(conn, request_id, actor, actor, "SUBMITTED", "DRAFT", "PENDING_APPROVAL")
    return response(await load_request(conn, request_id), "Leave submitted")


@router.post("/requests/{request_id}/withdraw")
async def withdraw_request(request_id: uuid.UUID, body: DecisionInput, conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.request.submit"))):
    actor = await local_user(conn, claims)
    async with conn.transaction():
        row = await conn.fetchrow("SELECT * FROM leave_requests WHERE id=$1 FOR UPDATE", request_id)
        if not row or row["student_id"] != actor: raise HTTPException(404, "Leave request not found")
        if row["status"] not in ("DRAFT", "SUBMITTED", "PENDING_APPROVAL"): raise HTTPException(409, "This request can no longer be withdrawn")
        old = row["status"]
        await conn.execute("UPDATE leave_requests SET status='WITHDRAWN',updated_at=now() WHERE id=$1", request_id)
        await conn.execute("UPDATE leave_rfid_permissions SET status='REVOKED' WHERE request_id=$1", request_id)
        await audit(conn, request_id, actor, actor, "WITHDRAWN", old, "WITHDRAWN", body.comment)
        await conn.execute("INSERT INTO leave_notifications(request_id,recipient_id,event) VALUES($1,$2,'WITHDRAWN')", request_id, actor)
    return response(await load_request(conn, request_id), "Leave withdrawn")


@router.get("/approvals/pending")
async def pending_approvals(conn=Depends(get_db), claims: Claims = Depends(get_current_claims)):
    actor = await local_user(conn, claims)
    permissions = [permission for permission in STAGE_PERMISSIONS if can_approve(claims, permission)]
    if not permissions:
        raise HTTPException(403, "No leave approval permission")
    base_query = """
        SELECT r.*, t.name AS leave_type, t.code AS leave_type_code,
               COALESCE(p.full_name, u.email) AS student_name,
               p.roll_number, p.room_number, p.course, p.semester,
               h.name AS hostel_name, u.email, u.phone AS student_phone
        FROM leave_requests r
        JOIN leave_types t ON t.id=r.leave_type_id
        JOIN student_profiles p ON p.user_id=r.student_id
        LEFT JOIN hostels h ON h.id=p.hostel_id
        JOIN users u ON u.id=r.student_id
        WHERE r.status='PENDING_APPROVAL' AND r.workflow_snapshot->>r.current_stage = ANY($1::text[])
          AND NOT EXISTS(SELECT 1 FROM leave_approvals a WHERE a.request_id=r.id AND a.stage_index=r.current_stage)
    """
    if claims.has_any_role("WARDEN") and not claims.has_any_role("SUPER_ADMIN", "ADMIN"):
        warden_hostels = await resolve_warden_hostel_scope(conn, claims)
        if not warden_hostels:
            return response([])
        rows = await conn.fetch(f"{base_query} AND p.hostel_id = ANY($2::uuid[]) ORDER BY r.submitted_at", permissions, warden_hostels)
    else:
        rows = await conn.fetch(f"{base_query} ORDER BY r.submitted_at", permissions)
    return response([dict(r) for r in rows])


async def decide(request_id, body, approve, conn, claims):
    actor = await local_user(conn, claims)
    async with conn.transaction():
        row = await conn.fetchrow("SELECT * FROM leave_requests WHERE id=$1 FOR UPDATE", request_id)
        if not row: raise HTTPException(404, "Leave request not found")
        if row["status"] != "PENDING_APPROVAL": raise HTTPException(409, "Request is not pending approval")
        flow = json_value(row["workflow_snapshot"])
        if row["current_stage"] >= len(flow): raise HTTPException(409, "Workflow stage is invalid")
        permission = flow[row["current_stage"]]
        if not can_approve(claims, permission): raise HTTPException(403, "You lack the permission for this approval stage")
        if not approve and not body.comment.strip(): raise HTTPException(400, "A rejection comment is required")
        existing = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM leave_approvals WHERE request_id=$1 AND stage_index=$2)", request_id, row["current_stage"])
        if existing: raise HTTPException(409, "This stage already has a decision")
        await conn.execute("INSERT INTO leave_approvals(request_id,stage_index,permission,actor_id,decision,comment) VALUES($1,$2,$3,$4,$5,$6)", request_id,row["current_stage"],permission,actor,"APPROVED" if approve else "REJECTED",body.comment)
        if not approve:
            new="REJECTED"
            await conn.execute("INSERT INTO leave_notifications(request_id,recipient_id,event,payload) VALUES($1,$2,'REJECTED',$3::jsonb)",request_id,row["student_id"],json.dumps({"comment":body.comment}))
        elif row["current_stage"] + 1 < len(flow):
            new="PENDING_APPROVAL"
            await conn.execute("UPDATE leave_requests SET current_stage=current_stage+1,status=$2,updated_at=now() WHERE id=$1", request_id,new)
            await notify_permission(conn, request_id, flow[row["current_stage"]+1], "APPROVAL_REQUIRED")
        else:
            new="APPROVED"
            await conn.execute("UPDATE leave_requests SET status=$2,updated_at=now() WHERE id=$1",request_id,new)
            await conn.execute("INSERT INTO leave_rfid_permissions(request_id,student_id,starts_at,ends_at) VALUES($1,$2,$3,$4) ON CONFLICT(request_id) DO NOTHING",request_id,row["student_id"],row["start_at"],row["end_at"])
            await audit(conn,request_id,row["student_id"],actor,"RFID_ACCESS_GRANTED",None,"ACTIVE",metadata={"starts_at":row["start_at"].isoformat(),"ends_at":row["end_at"].isoformat()})
            await conn.execute("INSERT INTO leave_notifications(request_id,recipient_id,event) VALUES($1,$2,'APPROVED')",request_id,row["student_id"])
        await conn.execute("UPDATE leave_requests SET status=$2,updated_at=now() WHERE id=$1",request_id,new)
        await audit(conn,request_id,row["student_id"],actor,"APPROVED" if approve else "REJECTED",row["status"],new,body.comment,permission)
    return response(await load_request(conn,request_id), "Approval recorded" if approve else "Request rejected")


@router.post("/requests/{request_id}/approve")
async def approve(request_id: uuid.UUID, body: DecisionInput, conn=Depends(get_db), claims: Claims = Depends(get_current_claims)):
    return await decide(request_id,body,True,conn,claims)


@router.post("/requests/{request_id}/reject")
async def reject(request_id: uuid.UUID, body: DecisionInput, conn=Depends(get_db), claims: Claims = Depends(get_current_claims)):
    return await decide(request_id,body,False,conn,claims)


@router.post("/requests/{request_id}/pending")
async def mark_pending(
    request_id: uuid.UUID,
    body: DecisionInput,
    conn=Depends(get_db),
    claims: Claims = Depends(get_current_claims),
):
    actor = await local_user(conn, claims)
    async with conn.transaction():
        row = await conn.fetchrow("SELECT * FROM leave_requests WHERE id=$1 FOR UPDATE", request_id)
        if not row:
            raise HTTPException(404, "Leave request not found")
        old_status = row["status"]
        flow = json_value(row["workflow_snapshot"])
        permission = flow[row["current_stage"]] if row["current_stage"] < len(flow) else None
        if permission and not can_approve(claims, permission) and not claims.has_any_role("SUPER_ADMIN", "ADMIN"):
            raise HTTPException(403, "You lack permission to review this leave request")

        await conn.execute("DELETE FROM leave_approvals WHERE request_id=$1 AND stage_index=$2", request_id, row["current_stage"])
        await conn.execute("UPDATE leave_requests SET status='PENDING_APPROVAL', updated_at=now() WHERE id=$1", request_id)
        await conn.execute("UPDATE leave_rfid_permissions SET status='REVOKED' WHERE request_id=$1", request_id)
        comment = body.comment.strip() or "Application placed on hold / pending review by warden"
        await audit(conn, request_id, row["student_id"], actor, "PENDING", old_status, "PENDING_APPROVAL", comment, permission)
        await conn.execute("INSERT INTO leave_notifications(request_id,recipient_id,event,payload) VALUES($1,$2,'PENDING',$3::jsonb)",
                           request_id, row["student_id"], json.dumps({"comment": comment}))
    return response(await load_request(conn, request_id), "Leave application marked as pending")


@router.post("/requests/{request_id}/documents")
async def upload_document(request_id: uuid.UUID, file: UploadFile = File(...), conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.request.submit"))):
    actor = await local_user(conn, claims)
    item = await load_request(conn, request_id)
    if item["student_id"] != actor or item["status"] not in ("DRAFT","PENDING_APPROVAL"):
        raise HTTPException(403, "Cannot upload a document for this request")
    if file.content_type not in ALLOWED_DOCUMENT_TYPES: raise HTTPException(415, "Only PDF, JPEG, and PNG documents are accepted")
    data = await file.read(MAX_DOCUMENT_BYTES + 1)
    if not data or len(data)>MAX_DOCUMENT_BYTES: raise HTTPException(413, "Document must be at most 10 MB")
    signatures = {"application/pdf": b"%PDF-", "image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n"}
    if not data.startswith(signatures[file.content_type]): raise HTTPException(415, "Document contents do not match the declared file type")
    doc_id = await conn.fetchval("INSERT INTO leave_documents(request_id,uploaded_by,filename,content_type,content) VALUES($1,$2,$3,$4,$5) RETURNING id",request_id,actor,file.filename or "document",file.content_type,data)
    return response({"id":doc_id,"filename":file.filename},"Document uploaded")


@router.get("/documents/{document_id}")
async def get_document(document_id: uuid.UUID, conn=Depends(get_db), claims: Claims = Depends(get_current_claims)):
    row = await conn.fetchrow("SELECT d.*,r.student_id FROM leave_documents d JOIN leave_requests r ON r.id=d.request_id WHERE d.id=$1",document_id)
    if not row: raise HTTPException(404,"Document not found")
    item,_=await accessible_request(conn,claims,row["request_id"])
    from fastapi.responses import Response
    return Response(row["content"],media_type=row["content_type"],headers={"Content-Disposition":f'attachment; filename="{row["filename"].replace(chr(34), "")}"'})


@router.put("/types/{type_id}/workflow")
async def set_workflow(type_id: uuid.UUID, body: WorkflowInput, conn=Depends(get_db), claims: Claims = Depends(require_permission("leave.workflow.manage"))):
    if not body.workflow or any(p not in STAGE_PERMISSIONS for p in body.workflow): raise HTTPException(400,"Workflow must contain valid approval permission stages")
    row=await conn.fetchrow("UPDATE leave_types SET workflow=$2::jsonb,updated_at=now() WHERE id=$1 RETURNING id,code,name,workflow",type_id,json.dumps(body.workflow))
    if not row: raise HTTPException(404,"Leave type not found")
    return response(dict(row),"Workflow updated; applies to new submissions")


@router.put("/balances")
async def set_balance(body: BalanceInput, conn=Depends(get_db), claims: Claims=Depends(require_permission("leave.balance.manage"))):
    row=await conn.fetchrow("""INSERT INTO leave_balances(student_id,leave_type_id,academic_period,allowed_days,allow_negative)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,leave_type_id,academic_period) DO UPDATE SET allowed_days=EXCLUDED.allowed_days,allow_negative=EXCLUDED.allow_negative,updated_at=now() RETURNING *""",body.student_id,body.leave_type_id,body.academic_period,body.allowed_days,body.allow_negative)
    return response(dict(row),"Balance configured")


@router.get("/balances/me")
async def my_balances(conn=Depends(get_db), claims: Claims=Depends(get_current_claims)):
    actor=await local_user(conn,claims)
    rows=await conn.fetch("SELECT b.*,t.name leave_type FROM leave_balances b JOIN leave_types t ON t.id=b.leave_type_id WHERE student_id=$1 ORDER BY academic_period DESC,t.name",actor)
    return response([dict(r) for r in rows])


@router.post("/delegations")
async def create_delegation(body: DelegationInput, conn=Depends(get_db), claims: Claims=Depends(require_permission("leave.delegate"))):
    if body.permission not in STAGE_PERMISSIONS or not can_approve(claims,body.permission): raise HTTPException(403,"Cannot delegate this permission")
    actor=await local_user(conn,claims)
    if body.ends_at <= body.starts_at: raise HTTPException(400,"Delegation end must follow start")
    expected={"leave.approve.warden":"WARDEN","leave.approve.chancellor":"CHANCELLOR","leave.approve.medical":"MEDICAL_OFFICER"}[body.permission]
    has_role=await conn.fetchval("SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id WHERE ur.user_id=$1 AND upper(ro.name)=$2)",body.delegate_id,expected)
    if not has_role: raise HTTPException(400,"Delegate does not have the required approval role")
    row=await conn.fetchrow("INSERT INTO leave_delegations(delegator_id,delegate_id,permission,starts_at,ends_at,reason) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",actor,body.delegate_id,body.permission,body.starts_at,body.ends_at,body.reason)
    await audit(conn,None,None,actor,"DELEGATED",None,"ACTIVE",body.reason,body.permission,{"delegate_id":str(body.delegate_id)})
    return response(dict(row),"Delegation created")


@router.get("/audit")
async def audit_logs(conn=Depends(get_db), claims: Claims=Depends(require_permission("leave.audit.view")), limit: int=Query(100,ge=1,le=500), offset: int=Query(0,ge=0), request_id: Optional[uuid.UUID]=None):
    rows=await conn.fetch("SELECT * FROM leave_audit_logs WHERE ($1::uuid IS NULL OR request_id=$1) ORDER BY created_at DESC LIMIT $2 OFFSET $3",request_id,limit,offset)
    return {"success":True,"data":[dict(r) for r in rows],"pagination":{"limit":limit,"offset":offset}}


@router.post("/rfid/return/{card_uid}")
async def record_return(card_uid: str, conn=Depends(get_db), claims: Claims=Depends(require_permission("gate.review.manual"))):
    row=await conn.fetchrow("""SELECT r.* FROM leave_requests r JOIN user_rfid_cards ur ON ur.user_id=r.student_id
      JOIN rfid_cards c ON c.id=ur.rfid_card_id WHERE c.uid=$1 AND ur.unassigned_at IS NULL AND r.status='APPROVED'
      ORDER BY r.end_at LIMIT 1 FOR UPDATE OF r""",card_uid)
    if not row: raise HTTPException(404,"No active approved leave matches this card")
    async with conn.transaction():
        await conn.execute("UPDATE leave_requests SET status='COMPLETED',returned_at=now(),updated_at=now() WHERE id=$1",row["id"])
        await conn.execute("UPDATE leave_rfid_permissions SET status='REVOKED' WHERE request_id=$1",row["id"])
        await audit(conn,row["id"],row["student_id"],None,"RETURNED","APPROVED","COMPLETED")
    return response({"request_id":row["id"],"status":"COMPLETED"},"Return recorded")


async def process_expired_leaves(conn: asyncpg.Connection) -> int:
    """Idempotently expire approved leaves and revoke their temporary permissions."""
    async with conn.transaction():
        rows=await conn.fetch("UPDATE leave_requests SET status='EXPIRED',updated_at=now() WHERE status='APPROVED' AND end_at < now() RETURNING id,student_id")
        for row in rows:
            await conn.execute("UPDATE leave_rfid_permissions SET status='REVOKED' WHERE request_id=$1 AND status='ACTIVE'",row["id"])
            await conn.execute("INSERT INTO leave_notifications(request_id,recipient_id,event) VALUES($1,$2,'EXPIRED')",row["id"],row["student_id"])
            await audit(conn,row["id"],row["student_id"],None,"EXPIRED","APPROVED","EXPIRED")
            await audit(conn,row["id"],row["student_id"],None,"RFID_ACCESS_REVOKED","ACTIVE","REVOKED")
        return len(rows)
