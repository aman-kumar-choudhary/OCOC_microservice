from app.schemas.hostel import CreatePermissionRequest
import pydantic
try:
    CreatePermissionRequest(**{
        "student_id": "d3c77534-0eb2-4913-86ae-9c2e90590e01",
        "permission_type": "CAMPUS_EXIT",
        "start_time": "2026-09-20T16:50:00.000Z",
        "end_time": "2026-09-21T16:50:00.000Z",
        "reason": ""
    })
    print("Success")
except pydantic.ValidationError as e:
    print(e)
