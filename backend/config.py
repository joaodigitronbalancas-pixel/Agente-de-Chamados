import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Carrega variáveis de ambiente do arquivo .env caso exista
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "glpi_data.json"

class Settings:
    GLPI_BASE_URL: str = os.getenv("GLPI_BASE_URL", "http://localhost:8080/apirest.php").strip()
    GLPI_APP_TOKEN: str = os.getenv("GLPI_APP_TOKEN", "").strip()
    GLPI_USER_TOKEN: str = os.getenv("GLPI_USER_TOKEN", "").strip()
    GLPI_USERNAME: str = os.getenv("GLPI_USERNAME", "joao.leopoldino").strip()
    GLPI_PASSWORD: str = os.getenv("GLPI_PASSWORD", "").strip()
    GLPI_ENTITY_ID: int = int(os.getenv("GLPI_ENTITY_ID", "0"))
    GLPI_DEFAULT_IT_GROUP_ID: int = int(os.getenv("GLPI_DEFAULT_IT_GROUP_ID", "1"))
    GLPI_DEFAULT_IT_GROUP_NAME: str = os.getenv("GLPI_DEFAULT_IT_GROUP_NAME", "Equipe de TI")
    
    SCHEDULER_INTERVAL_SEC: int = int(os.getenv("SCHEDULER_INTERVAL_SEC", "20"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # CORS Origins
    _raw_cors = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    )
    CORS_ORIGINS: List[str] = [origin.strip() for origin in _raw_cors.split(",") if origin.strip()]

settings = Settings()

def mask_token(token: str) -> str:
    """Mascara o token para exibição segura sem expor segredos."""
    if not token:
        return ""
    if len(token) <= 6:
        return "******"
    return f"***{token[-4:]}"
