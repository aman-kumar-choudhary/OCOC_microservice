import pytest
import numpy as np
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import Person, FaceEmbedding
from app.config import settings

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
def mock_pipeline(monkeypatch):
    class MockPipeline:
        async def extract_embeddings(self, image):
            # Return dummy 512-dim embedding
            emb = np.random.rand(512).astype(np.float32)
            emb = emb / np.linalg.norm(emb)
            return {"grayscale": emb}, {"step1": 10.0}, {"detection": "mock", "recognition": "mock"}

        async def extract_embeddings_for_all_faces(self, image):
            emb1 = np.random.rand(512).astype(np.float32)
            emb1 = emb1 / np.linalg.norm(emb1)
            emb2 = np.random.rand(512).astype(np.float32)
            emb2 = emb2 / np.linalg.norm(emb2)
            
            return [
                (np.array([0, 0, 10, 10]), 0.99, {"grayscale": emb1}),
                (np.array([20, 20, 30, 30]), 0.95, {"grayscale": emb2})
            ], {"step1": 20.0}, {"detection": "mock", "recognition": "mock"}

    monkeypatch.setattr(app.state, "pipeline", MockPipeline())

async def test_recognize_no_match(client, mock_pipeline, db_session: AsyncSession):
    # Send a dummy image, expect no match because DB is empty
    files = {"image": ("dummy.jpg", b"fake_image_data", "image/jpeg")}
    
    # Mocking decode_uploaded_image to return dummy numpy array
    import app.api.identity as identity
    async def mock_read_upload(upload):
        return np.zeros((100, 100, 3), dtype=np.uint8)
    
    identity._read_upload = mock_read_upload

    response = await client.post("/api/v1/recognize", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["recognized"] is False
    assert data["message"] == "No matching user found"

async def test_recognize_mass_no_match(client, mock_pipeline, db_session: AsyncSession):
    files = {"image": ("dummy.jpg", b"fake_image_data", "image/jpeg")}
    response = await client.post("/api/v1/recognize/mass", files=files)
    assert response.status_code == 200
    data = response.json()
    assert len(data["faces"]) == 2
    assert data["faces"][0]["recognized"] is False
    assert data["faces"][1]["recognized"] is False
