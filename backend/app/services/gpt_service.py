"""
GPT API service for code analysis and generation.
"""

import os
import logging
import json
from typing import Dict, List, Optional, Tuple
from openai import OpenAI
from flask import current_app

logger = logging.getLogger(__name__)

class GPTService:
    def __init__(self):
        self.client = None
        self.api_key = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize OpenAI client with API key."""
        self.api_key = os.getenv('OPENAI_API_KEY')
        if self.api_key:
            try:
                # Initialize OpenAI client with basic configuration for v1.3.0
                # Note: Proxy support removed due to version compatibility issues
                self.client = OpenAI(
                    api_key=self.api_key,
                    timeout=30.0,
                    max_retries=3
                )
                logger.info("GPT service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize GPT client: {e}")
                self.client = None
        else:
            logger.warning("OPENAI_API_KEY not found in environment variables")
    
    def is_configured(self) -> bool:
        """Check if GPT service is properly configured."""
        return self.client is not None and self.api_key is not None
    
    def analyze_code(self, code: str, language: str, explain_level: str = "medium") -> Dict:
        """
        Analyze code and provide corrections, explanations, and examples.
        
        Args:
            code: The code to analyze
            language: Programming language
            explain_level: "short", "medium", or "long"
        
        Returns:
            Dict containing analysis results
        """
        if not self.is_configured():
            return {
                'success': False,
                'error': 'GPT service not configured. Please set OPENAI_API_KEY.'
            }
        
        try:
            # Create analysis prompt based on explain level
            prompt = self._create_analysis_prompt(code, language, explain_level)
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert code analyzer and teacher. Provide detailed, accurate code analysis with corrections, explanations, and real-world examples."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=2000,
                temperature=0.3
            )
            
            analysis_text = response.choices[0].message.content
            
            # Parse the structured response
            analysis_result = self._parse_analysis_response(analysis_text, code, language)
            
            return {
                'success': True,
                'analysis': analysis_result
            }
            
        except Exception as e:
            logger.error(f"GPT analysis failed: {e}")
            return {
                'success': False,
                'error': f'Analysis failed: {str(e)}'
            }
    
    def generate_code(self, prompt: str, language: str, explain_level: str = "medium") -> Dict:
        """
        Generate code based on user prompt.
        
        Args:
            prompt: User's code generation request
            language: Target programming language
            explain_level: Level of explanation detail
        
        Returns:
            Dict containing generated code and explanation
        """
        if not self.is_configured():
            return {
                'success': False,
                'error': 'GPT service not configured. Please set OPENAI_API_KEY.'
            }
        
        try:
            generation_prompt = self._create_generation_prompt(prompt, language, explain_level)
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert programmer. Generate clean, efficient, well-documented code with detailed explanations."
                    },
                    {
                        "role": "user",
                        "content": generation_prompt
                    }
                ],
                max_tokens=2000,
                temperature=0.3
            )
            
            generation_text = response.choices[0].message.content
            
            # Parse the structured response
            generation_result = self._parse_generation_response(generation_text, language)
            
            return {
                'success': True,
                'generation': generation_result
            }
            
        except Exception as e:
            logger.error(f"Code generation failed: {e}")
            return {
                'success': False,
                'error': f'Code generation failed: {str(e)}'
            }
    
    def _create_analysis_prompt(self, code: str, language: str, explain_level: str) -> str:
        """Create analysis prompt based on explain level."""
        base_prompt = f"""
Analyze this {language} code and provide a structured response:

CODE:
```{language}
{code}
```

Please provide your analysis in the following JSON format:
{{
    "corrections": {{
        "has_issues": boolean,
        "issues": [
            {{
                "line": number,
                "type": "syntax|logic|style|performance|security",
                "description": "Issue description",
                "suggestion": "How to fix it"
            }}
        ],
        "corrected_code": "The corrected version of the code"
    }},
    "line_by_line_explanation": [
        {{
            "line": number,
            "code": "actual line of code",
            "explanation": "What this line does"
        }}
    ],
    "overall_explanation": "Overall explanation of what the code does",
    "real_world_example": "A practical real-world scenario where this code would be useful"
}}
"""
        
        if explain_level == "short":
            base_prompt += "\nKeep explanations concise and focus on key points only."
        elif explain_level == "long":
            base_prompt += "\nProvide detailed explanations with examples, best practices, and additional context."
        else:  # medium
            base_prompt += "\nProvide balanced explanations with good detail but not overwhelming."
        
        return base_prompt
    
    def _create_generation_prompt(self, prompt: str, language: str, explain_level: str) -> str:
        """Create code generation prompt."""
        base_prompt = f"""
Generate {language} code based on this request: "{prompt}"

Please provide your response in the following JSON format:
{{
    "generated_code": "The complete, working code",
    "explanation": "Explanation of how the code works",
    "line_by_line_explanation": [
        {{
            "line": number,
            "code": "actual line of code",
            "explanation": "What this line does"
        }}
    ],
    "usage_example": "How to use this code with sample input/output",
    "best_practices": ["List of best practices demonstrated in the code"]
}}
"""
        
        if explain_level == "short":
            base_prompt += "\nKeep explanations brief and to the point."
        elif explain_level == "long":
            base_prompt += "\nProvide comprehensive explanations with detailed examples and context."
        else:  # medium
            base_prompt += "\nProvide clear, moderately detailed explanations."
        
        return base_prompt
    
    def _parse_analysis_response(self, response_text: str, original_code: str, language: str) -> Dict:
        """Parse GPT analysis response into structured format."""
        try:
            # Try to extract JSON from the response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx != -1 and end_idx != -1:
                json_str = response_text[start_idx:end_idx]
                parsed = json.loads(json_str)
                
                # Add diff information if corrections exist
                if parsed.get('corrections', {}).get('corrected_code'):
                    parsed['corrections']['diff'] = self._generate_diff(
                        original_code, 
                        parsed['corrections']['corrected_code']
                    )
                
                return parsed
            else:
                # Fallback: create structured response from text
                return self._create_fallback_analysis(response_text, original_code)
                
        except json.JSONDecodeError:
            # Fallback: create structured response from text
            return self._create_fallback_analysis(response_text, original_code)
    
    def _parse_generation_response(self, response_text: str, language: str) -> Dict:
        """Parse GPT generation response into structured format."""
        try:
            # Try to extract JSON from the response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx != -1 and end_idx != -1:
                json_str = response_text[start_idx:end_idx]
                return json.loads(json_str)
            else:
                # Fallback: create structured response from text
                return self._create_fallback_generation(response_text)
                
        except json.JSONDecodeError:
            # Fallback: create structured response from text
            return self._create_fallback_generation(response_text)
    
    def _generate_diff(self, original: str, corrected: str) -> List[Dict]:
        """Generate diff between original and corrected code."""
        import difflib
        
        original_lines = original.splitlines()
        corrected_lines = corrected.splitlines()
        
        diff = []
        for line in difflib.unified_diff(original_lines, corrected_lines, lineterm=''):
            if line.startswith('@@'):
                continue
            elif line.startswith('-'):
                diff.append({'type': 'removed', 'content': line[1:]})
            elif line.startswith('+'):
                diff.append({'type': 'added', 'content': line[1:]})
            else:
                diff.append({'type': 'unchanged', 'content': line})
        
        return diff
    
    def _create_fallback_analysis(self, response_text: str, original_code: str) -> Dict:
        """Create fallback analysis structure when JSON parsing fails."""
        lines = original_code.splitlines()
        
        return {
            'corrections': {
                'has_issues': False,
                'issues': [],
                'corrected_code': original_code,
                'diff': []
            },
            'line_by_line_explanation': [
                {
                    'line': i + 1,
                    'code': line,
                    'explanation': 'Analysis available in overall explanation'
                }
                for i, line in enumerate(lines) if line.strip()
            ],
            'overall_explanation': response_text,
            'real_world_example': 'See overall explanation for context and examples.'
        }
    
    def _create_fallback_generation(self, response_text: str) -> Dict:
        """Create fallback generation structure when JSON parsing fails."""
        return {
            'generated_code': response_text,
            'explanation': 'Generated code with explanation included in the response.',
            'line_by_line_explanation': [],
            'usage_example': 'See the generated code for usage patterns.',
            'best_practices': []
        }

# Global service instance
gpt_service = GPTService()