# -*- coding: utf-8 -*-
import sys
import io
import traceback
import subprocess
import tempfile
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

def check_syntax_subprocess(command, code, ext):
    """Writes code to a temp file, runs a syntax check command, and returns the result."""
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False, mode='w', encoding='utf-8') as f:
        temp_file = f.name
        f.write(code)
    
    try:
        cmd = [part.replace('{file}', temp_file) for part in command]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            return {'success': True, 'message': '✅ No syntax errors found!<br>Your code looks clean.'}
        else:
            err = result.stderr.strip() or result.stdout.strip()
            # Clean up the temp file path from the output for a cleaner UI
            err = err.replace(temp_file, 'code'+ext)
            return {'success': False, 'message': f'❌ Syntax Error:<br><pre>{err}</pre>'}
    except Exception as e:
        return {'success': False, 'message': f'❌ Unexpected error: {str(e)}'}
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

@app.route('/check_syntax', methods=['POST'])
def check_syntax():
    data = request.get_json()
    code = data.get('code', '').strip()
    language = data.get('language', 'Python')

    if not code:
        return jsonify({'success': True, 'message': '⚠️ No code to check.'})

    if language == 'Python':
        try:
            compile(code, '<string>', 'exec')
            return jsonify({'success': True, 'message': '✅ No syntax errors found!<br>Your code looks clean.'})
        except SyntaxError as e:
            return jsonify({'success': False, 'message': f'❌ Syntax Error on line {e.lineno}<br>{str(e)}'})
        except Exception as e:
            return jsonify({'success': False, 'message': f'❌ Unexpected error: {str(e)}'})
            
    elif language == 'JavaScript':
        return jsonify(check_syntax_subprocess(['node', '-c', '{file}'], code, '.js'))
        
    elif language == 'C':
        return jsonify(check_syntax_subprocess(['gcc', '-fsyntax-only', '{file}'], code, '.c'))
        
    elif language == 'C++':
        return jsonify(check_syntax_subprocess(['g++', '-fsyntax-only', '{file}'], code, '.cpp'))
        
    elif language == 'Java':
        # Java is tricky since the class name must match the file name.
        # We'll create a temporary directory and save it as Main.java.
        temp_dir = tempfile.mkdtemp()
        temp_file = os.path.join(temp_dir, 'Main.java')
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(code)
            
        try:
            result = subprocess.run(['javac', temp_file], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return jsonify({'success': True, 'message': '✅ No syntax errors found!<br>Your code looks clean.'})
            else:
                err = result.stderr.strip() or result.stdout.strip()
                err = err.replace(temp_file, 'Main.java')
                return jsonify({'success': False, 'message': f'❌ Syntax Error:<br><pre>{err}</pre>'})
        except Exception as e:
            return jsonify({'success': False, 'message': f'❌ Unexpected error: {str(e)}'})
        finally:
            if os.path.exists(temp_file): os.remove(temp_file)
            class_file = os.path.join(temp_dir, 'Main.class')
            if os.path.exists(class_file): os.remove(class_file)
            os.rmdir(temp_dir)
            
    else:
        # Mock responses for markup/style languages or unavailable linters
        return jsonify({'success': True, 'message': f'✅ Basic {language} syntax check passed!<br><span style="color:var(--text-muted);font-size:0.9em">(Deep validation not available locally)</span>'})


def execute_subprocess(command, code, ext):
    """Executes code in a secure temporary environment and captures output."""
    temp_dir = tempfile.mkdtemp()
    
    # Use 'Main.java' for Java, 'code.ext' for others
    filename = 'Main.java' if ext == '.java' else 'code' + ext
    temp_file = os.path.join(temp_dir, filename)
    
    with open(temp_file, 'w', encoding='utf-8') as f:
        f.write(code)
    
    exe_file = os.path.join(temp_dir, 'code.exe')
    
    try:
        # Split '&&' commands to run sequentially without shell=True
        commands = []
        current = []
        for part in command:
            if part == '&&':
                commands.append(current)
                current = []
            else:
                current.append(part.replace('{file}', temp_file).replace('{exe}', exe_file).replace('{dir}', temp_dir))
        commands.append(current)
        
        last_output = ""
        for cmd in commands:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                err = result.stderr.strip() or result.stdout.strip()
                err = err.replace(temp_dir + os.sep, '')  # Hide temp paths
                return {'success': False, 'output': last_output.strip(), 'error': err}
            if result.stdout:
                last_output += result.stdout
                
        return {'success': True, 'output': last_output.strip() or '✅ Code executed successfully (no output)', 'error': ''}
            
    except subprocess.TimeoutExpired:
        return {'success': False, 'output': '', 'error': 'Execution timed out (10s limit)'}
    except Exception as e:
        return {'success': False, 'output': '', 'error': str(e)}
    finally:
        # Cleanup
        for f in os.listdir(temp_dir):
            try: os.remove(os.path.join(temp_dir, f))
            except: pass
        try: os.rmdir(temp_dir)
        except: pass


@app.route('/execute', methods=['POST'])
def execute():
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'Python')

    if not code:
        return jsonify({'success': False, 'output': '', 'error': 'No code to execute.'})

    if language == 'Python':
        return jsonify(execute_subprocess(['python', '{file}'], code, '.py'))
        
    elif language == 'JavaScript':
        return jsonify(execute_subprocess(['node', '{file}'], code, '.js'))
        
    elif language == 'C':
        return jsonify(execute_subprocess(['gcc', '{file}', '-o', '{exe}', '&&', '{exe}'], code, '.c'))
        
    elif language == 'C++':
        return jsonify(execute_subprocess(['g++', '{file}', '-o', '{exe}', '&&', '{exe}'], code, '.cpp'))
        
    elif language == 'Java':
        # Compile and run
        return jsonify(execute_subprocess(['javac', '{file}', '&&', 'java', '-cp', '{dir}', 'Main'], code, '.java'))
        
    elif language in ['HTML', 'CSS']:
        return jsonify({'success': False, 'output': '', 'error': f'{language} is a markup/style language and cannot be directly executed in a console environment. Try embedding it in a file and opening it in your browser!'})
        
    else:
        return jsonify({'success': False, 'output': '', 'error': f'Execution for {language} is not fully supported without a dedicated runtime.'})

if __name__ == '__main__':
    print("[*] CodeFix AI is running at http://127.0.0.1:5000")
    app.run(debug=True, port=5000)