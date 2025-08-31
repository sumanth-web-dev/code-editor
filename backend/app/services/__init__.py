# Services package
import logging

logger = logging.getLogger(__name__)

# Import core services first
from .execution_service import execution_service
from .usage_service import usage_service

# Import AI services with error handling
gpt_service = None
gemini_service = None
together_service = None
ai_service = None

try:
    from .gpt_service import gpt_service
except ImportError as e:
    logger.warning(f"Failed to import GPT service: {e}")

try:
    from .gemini_service import gemini_service
except ImportError as e:
    logger.warning(f"Failed to import Gemini service: {e}")

try:
    from .together_service import together_service
except ImportError as e:
    logger.warning(f"Failed to import Together service: {e}")

try:
    from .ai_service import ai_service
except ImportError as e:
    logger.warning(f"Failed to import AI service: {e}")

__all__ = [
    'gpt_service',
    'gemini_service', 
    'together_service',
    'ai_service',
    'execution_service',
    'usage_service'
]