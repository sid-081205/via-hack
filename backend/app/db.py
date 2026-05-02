from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.MONGODB_DB]

users_col = db.users
trips_col = db.trips
todos_col = db.todos
messages_col = db.messages
agent_tasks_col = db.agent_tasks
travel_plan_col = db.travel_plan
