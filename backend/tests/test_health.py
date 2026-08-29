from fastapi.testclient import TestClient

from main import allow_origins, app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_both_production_frontend_origins() -> None:
    assert "https://flume-rosy.vercel.app" in allow_origins
    assert "https://flume-finance.vercel.app" in allow_origins


def test_cors_preflight_allows_new_production_origin() -> None:
    for origin in (
        "https://flume-rosy.vercel.app",
        "https://flume-finance.vercel.app",
    ):
        response = client.options(
            "/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin
