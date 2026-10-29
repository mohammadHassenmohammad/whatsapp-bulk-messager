from fastapi import APIRouter
from backend.app.api.customers import router as customers_router
from backend.app.api.categories import router as categories_router
from backend.app.api.templates import router as templates_router
from backend.app.api.campaigns import router as campaigns_router
from backend.app.api.analytics import router as analytics_router
from backend.app.api.settings import router as settings_router
from backend.app.api.inquiries import router as inquiries_router
from backend.app.api.webhooks import router as webhooks_router
from backend.app.api.media import router as media_router
from backend.app.api.providers import router as providers_router
from backend.app.api.crm import router as crm_router
from backend.app.api.ai import router as ai_router

api_router = APIRouter(prefix="/api")
api_router.include_router(customers_router)
api_router.include_router(categories_router)
api_router.include_router(templates_router)
api_router.include_router(campaigns_router)
api_router.include_router(analytics_router)
api_router.include_router(settings_router)
api_router.include_router(inquiries_router)
api_router.include_router(webhooks_router)
api_router.include_router(media_router)
api_router.include_router(providers_router)
api_router.include_router(crm_router)
api_router.include_router(ai_router)

