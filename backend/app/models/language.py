"""
Language configuration model and data.
"""

from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class Language:
    """Language configuration model."""
    id: str
    name: str
    version: str
    file_extension: str
    syntax_highlighting: str
    execution_command: str
    docker_image: Optional[str] = None
    supports_input: bool = True
    timeout_seconds: int = 30

    def to_dict(self) -> Dict:
        """Convert language to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'name': self.name,
            'version': self.version,
            'file_extension': self.file_extension,
            'syntax_highlighting': self.syntax_highlighting,
            'execution_command': self.execution_command,
            'docker_image': self.docker_image,
            'supports_input': self.supports_input,
            'timeout_seconds': self.timeout_seconds
        }

# Supported languages configuration (sorted alphabetically by name)
SUPPORTED_LANGUAGES = [
    Language(
        id='c',
        name='C',
        version='GCC 9+',
        file_extension='.c',
        syntax_highlighting='c',
        execution_command='gcc -o program && ./program',
        supports_input=True
    ),
    Language(
        id='cpp',
        name='C++',
        version='GCC 9+',
        file_extension='.cpp',
        syntax_highlighting='cpp',
        execution_command='g++ -o program && ./program',
        supports_input=True
    ),
    Language(
        id='csharp',
        name='C#',
        version='.NET 6+',
        file_extension='.cs',
        syntax_highlighting='csharp',
        execution_command='dotnet run',
        supports_input=True
    ),
    Language(
        id='css',
        name='CSS',
        version='CSS3',
        file_extension='.css',
        syntax_highlighting='css',
        execution_command='preview',
        supports_input=False,
        timeout_seconds=0
    ),
    Language(
        id='go',
        name='Go',
        version='1.19+',
        file_extension='.go',
        syntax_highlighting='go',
        execution_command='go run',
        supports_input=True
    ),
    Language(
        id='html',
        name='HTML',
        version='HTML5',
        file_extension='.html',
        syntax_highlighting='html',
        execution_command='preview',
        supports_input=False,
        timeout_seconds=0
    ),
    Language(
        id='java',
        name='Java',
        version='11+',
        file_extension='.java',
        syntax_highlighting='java',
        execution_command='javac && java',
        supports_input=True
    ),
    Language(
        id='javascript',
        name='JavaScript',
        version='Node.js 18+',
        file_extension='.js',
        syntax_highlighting='javascript',
        execution_command='node',
        supports_input=True
    ),
    Language(
        id='php',
        name='PHP',
        version='8.0+',
        file_extension='.php',
        syntax_highlighting='php',
        execution_command='php',
        supports_input=True
    ),
    Language(
        id='python',
        name='Python',
        version='3.9+',
        file_extension='.py',
        syntax_highlighting='python',
        execution_command='python',
        supports_input=True
    ),
    Language(
        id='r',
        name='R',
        version='4.0+',
        file_extension='.r',
        syntax_highlighting='r',
        execution_command='Rscript',
        supports_input=True
    ),
    Language(
        id='ruby',
        name='Ruby',
        version='3.0+',
        file_extension='.rb',
        syntax_highlighting='ruby',
        execution_command='ruby',
        supports_input=True
    ),
    Language(
        id='rust',
        name='Rust',
        version='1.65+',
        file_extension='.rs',
        syntax_highlighting='rust',
        execution_command='rustc -o program && ./program',
        supports_input=True
    ),
    Language(
        id='typescript',
        name='TypeScript',
        version='4.8+',
        file_extension='.ts',
        syntax_highlighting='typescript',
        execution_command='ts-node',
        supports_input=True
    )
]

def get_language_by_id(language_id: str) -> Optional[Language]:
    """Get language configuration by ID."""
    for lang in SUPPORTED_LANGUAGES:
        if lang.id == language_id:
            return lang
    return None

def get_all_languages() -> List[Language]:
    """Get all supported languages."""
    return SUPPORTED_LANGUAGES