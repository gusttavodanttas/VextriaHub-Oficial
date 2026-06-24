import re
import os

path = r'c:\Users\conta\Downloads\vextria-hub-v1-47-backup-entrega-joao-pedro-main\vextria-hub-v1-47-backup-entrega-joao-pedro-main\SUPABASE_COMPLETO.sql'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Fix policies: Add DROP POLICY IF EXISTS before CREATE POLICY
# Pattern: CREATE POLICY "name" [newline/space] ON table
# We use re.DOTALL to match across lines, but we need to find the name and table name.
def fix_policies(m):
    name = m.group(1).strip()
    table = m.group(2).strip()
    # Check if already has a DROP right before it (avoid double addition)
    prefix = f'DROP POLICY IF EXISTS "{name}" ON {table};\n'
    if prefix in content[max(0, m.start()-100):m.start()]:
        return m.group(0)
    return prefix + m.group(0)

# Regex to find CREATE POLICY "name" ON table
# Handles variations in spacing and newlines
policy_re = re.compile(r'CREATE\s+POLICY\s+"(.*?)"\s+ON\s+([^\s;]+)', re.IGNORECASE | re.DOTALL)
content = policy_re.sub(fix_policies, content)

# Fix triggers: Add DROP TRIGGER IF EXISTS name ON table
def fix_triggers(m):
    name = m.group(1).strip()
    table = m.group(2).strip()
    prefix = f'DROP TRIGGER IF EXISTS {name} ON {table};\n'
    if prefix in content[max(0, m.start()-100):m.start()]:
        return m.group(0)
    return prefix + m.group(0)

trigger_re = re.compile(r'CREATE\s+TRIGGER\s+([^\s]+)\s+.*?\s+ON\s+([^\s;]+)', re.IGNORECASE | re.DOTALL)
content = trigger_re.sub(fix_triggers, content)

# Ensure CREATE OR REPLACE for functions
content = content.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SQL file fixed successfully.")
