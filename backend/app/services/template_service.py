import re
from typing import Dict, List, Tuple, Any

VARIABLE_PATTERN = re.compile(r"\{([a-zA-Z0-9_]+)\}")

ALLOWED_VARIABLES = {"name", "company", "category", "phone"}

def extract_variables(template_str: str) -> List[str]:
    """Finds all unique variables in the template string."""
    if not template_str:
        return []
    return sorted(list(set(VARIABLE_PATTERN.findall(template_str))))

def render_template(
    template_str: str,
    context: Dict[str, Any],
    fallback_empty: bool = True
) -> Tuple[str, List[str]]:
    """
    Renders a template by substituting variables like {name}, {company}, {category}.
    Returns:
      (rendered_message, list_of_missing_or_empty_variables)
    """
    if not template_str:
        return "", []

    missing_vars = []
    
    def replacer(match):
        var_name = match.group(1).lower()
        # Look up value in context (case-insensitive lookup)
        val = None
        for k, v in context.items():
            if k.lower() == var_name:
                val = v
                break

        if val is None or str(val).strip() == "":
            missing_vars.append(match.group(1))
            return "" if fallback_empty else match.group(0)
        
        return str(val).strip()

    rendered = VARIABLE_PATTERN.sub(replacer, template_str)
    return rendered, list(set(missing_vars))
