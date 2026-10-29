import csv
import io
from typing import List, Dict, Any

def sanitize_csv_cell(value: Any) -> Any:
    """
    Guards against CSV Formula Injection (CWE-1236).
    If a string cell begins with =, +, -, @, tab, or carriage return,
    prefix it with a single quote (') so spreadsheet applications treat it as raw text.
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + val_str
    return val_str

def generate_csv(rows: List[Dict[str, Any]], fieldnames: List[str]) -> str:
    """Generates a safe CSV string from a list of dicts."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore', quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    for row in rows:
        sanitized_row = {k: sanitize_csv_cell(row.get(k, "")) for k in fieldnames}
        writer.writerow(sanitized_row)
    return output.getvalue()
