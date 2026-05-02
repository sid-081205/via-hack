from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    MONGODB_URI: str = Field(..., description="MongoDB Atlas connection string")
    MONGODB_DB: str = "via"

    GOOGLE_API_KEY: str = Field(..., description="Google Gemini API key")
    LLM_MODEL: str = "gemini-2.5-flash"

    PORT: int = 8000
    CORS_ALLOW_ORIGINS: str = "*"
    DEMO_USER_ID: str = "alex"
    DEMO_TRIP_ID: str = "trip_lisbon"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
