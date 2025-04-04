# tests/test_commit.py
from fastapi.testclient import TestClient
from app.main import app  # Corrected import

client = TestClient(app)

def test_create_commit_success():
    response = client.post("/commit/", json={
        "commit_message": "Initial commit",
        "conversation_context": {"messages": ["User: Hi", "AI: Hello!"]}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["commit_message"] == "Initial commit"
    assert "commit_hash" in data

def test_duplicate_commit():
    payload = {
        "commit_message": "Duplicate test",
        "conversation_context": {"messages": ["Test"]}
    }
    response1 = client.post("/commit/", json=payload)
    response2 = client.post("/commit/", json=payload)
    assert response2.status_code == 200  # hashes differ due to timestamp

def test_validation_error():
    response = client.post("/commit/", json={"commit_message": ""})
    assert response.status_code == 422  # Unprocessable Entity due to validation error

