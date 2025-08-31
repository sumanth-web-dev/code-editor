# Input Handling Test Examples

## Python Examples

### Example 1: Simple Input
```python
name = input("Enter your name: ")
print(f"Hello, {name}!")
```
**Input to provide:** `Alice`
**Expected Output:** `Hello, Alice!`

### Example 2: Multiple Inputs
```python
name = input("Enter your name: ")
age = input("Enter your age: ")
print(f"Hello {name}, you are {age} years old!")
```
**Input to provide:**
```
Alice
25
```
**Expected Output:** `Hello Alice, you are 25 years old!`

### Example 3: Numeric Input
```python
num1 = int(input("Enter first number: "))
num2 = int(input("Enter second number: "))
result = num1 + num2
print(f"{num1} + {num2} = {result}")
```
**Input to provide:**
```
10
20
```
**Expected Output:** `10 + 20 = 30`

## JavaScript Examples (Node.js)

### Example 1: Simple Input (if supported)
```javascript
// Note: JavaScript input handling depends on backend implementation
console.log("JavaScript input handling may vary based on backend support");
```

## Java Examples

### Example 1: Scanner Input
```java
import java.util.Scanner;

public class InputExample {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
        scanner.close();
    }
}
```
**Input to provide:** `Alice`
**Expected Output:** `Hello, Alice!`

## Testing Instructions

1. Copy one of the code examples above into the code editor
2. Paste the corresponding input into the Input section
3. Click "Run Code" or press Ctrl+Enter
4. Verify the output matches the expected result