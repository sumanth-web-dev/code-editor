/**
 * Service for managing code templates dynamically
 */

export interface CodeTemplate {
  language: string;
  name: string;
  description: string;
  code: string;
  category: 'basic' | 'example' | 'advanced';
}

class TemplateService {
  private templates: CodeTemplate[] = [];
  private initialized = false;

  async getTemplates(): Promise<CodeTemplate[]> {
    if (!this.initialized) {
      await this.loadTemplates();
    }
    return this.templates;
  }

  async getTemplateForLanguage(language: string, category: 'basic' | 'example' | 'advanced' = 'basic'): Promise<string> {
    const templates = await this.getTemplates();
    const template = templates.find(t => t.language === language && t.category === category);
    return template?.code || this.getBasicTemplate(language);
  }

  private async loadTemplates(): Promise<void> {
    try {
      // In a real implementation, this would fetch from backend
      // For now, we'll use minimal templates
      this.templates = this.getDefaultTemplates();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load templates:', error);
      this.templates = this.getDefaultTemplates();
      this.initialized = true;
    }
  }

  private getDefaultTemplates(): CodeTemplate[] {
    return [
      {
        language: 'python',
        name: 'Basic Python',
        description: 'Simple Python starter',
        code: 'print("Hello, World!")',
        category: 'basic'
      },
      {
        language: 'javascript',
        name: 'Basic JavaScript',
        description: 'Simple JavaScript starter',
        code: 'console.log("Hello, World!");',
        category: 'basic'
      },
      {
        language: 'html',
        name: 'Basic HTML',
        description: 'Simple HTML document',
        code: '<!DOCTYPE html>\n<html>\n<head>\n    <title>Document</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
        category: 'basic'
      },
      {
        language: 'css',
        name: 'Basic CSS',
        description: 'Simple CSS styles',
        code: 'body {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}',
        category: 'basic'
      },
      {
        language: 'java',
        name: 'Basic Java',
        description: 'Simple Java program',
        code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
        category: 'basic'
      },
      {
        language: 'cpp',
        name: 'Basic C++',
        description: 'Simple C++ program',
        code: '#include <iostream>\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
        category: 'basic'
      },
      {
        language: 'c',
        name: 'Basic C',
        description: 'Simple C program',
        code: '#include <stdio.h>\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
        category: 'basic'
      }
    ];
  }

  private getBasicTemplate(language: string): string {
    const basicTemplates: { [key: string]: string } = {
      'python': 'print("Hello, World!")',
      'javascript': 'console.log("Hello, World!");',
      'html': '<!DOCTYPE html>\n<html>\n<head>\n    <title>Document</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
      'css': 'body {\n    font-family: Arial, sans-serif;\n}',
      'java': 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
      'cpp': '#include <iostream>\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
      'c': '#include <stdio.h>\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
      'r': 'print("Hello, World!")',
      'csharp': 'using System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}',
      'php': '<?php\necho "Hello, World!";\n?>',
      'ruby': 'puts "Hello, World!"',
      'go': 'package main\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
      'rust': 'fn main() {\n    println!("Hello, World!");\n}',
      'typescript': 'console.log("Hello, World!");'
    };
    return basicTemplates[language] || 'console.log("Hello, World!");';
  }

  // Method to add custom templates (could be used for user-saved templates)
  addTemplate(template: CodeTemplate): void {
    this.templates.push(template);
  }

  // Method to get templates by category
  async getTemplatesByCategory(category: 'basic' | 'example' | 'advanced'): Promise<CodeTemplate[]> {
    const templates = await this.getTemplates();
    return templates.filter(t => t.category === category);
  }
}

export const templateService = new TemplateService();
export default templateService;