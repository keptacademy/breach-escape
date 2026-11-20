"""Minimal JSON Schema checker for tools/level.schema.json (standard library only).

Supports exactly the keywords that schema uses: type, enum, const, pattern, minLength, minimum,
minItems, maxItems, items, properties, patternProperties, required, additionalProperties,
oneOf, and $ref to #/$defs/... . If the schema starts using another keyword, check_schema()
refuses it, so the checker can't silently skip a rule.
"""
import json
import os
import re

SUPPORTED = {
    "$schema", "$id", "title", "description", "$defs",
    "type", "enum", "const", "pattern", "minLength", "minimum", "minItems", "maxItems",
    "items", "properties", "patternProperties", "required", "additionalProperties", "oneOf", "$ref",
}
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "level.schema.json")


def load_schema(path=SCHEMA_PATH):
    with open(path, encoding="utf-8") as f:
        schema = json.load(f)
    check_schema(schema)
    return schema


def check_schema(node, where="#"):
    if isinstance(node, dict):
        for k, v in node.items():
            if where.endswith("/properties") or where.endswith("/patternProperties") or where.endswith("/$defs"):
                check_schema(v, where + "/" + k)  # keys here are names, not keywords
                continue
            if k not in SUPPORTED:
                raise ValueError("schema keyword not supported by tools/schema_check.py: %s at %s" % (k, where))
            check_schema(v, where + "/" + k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            check_schema(v, "%s/%d" % (where, i))


def _type_ok(value, t):
    if t == "object":
        return isinstance(value, dict)
    if t == "array":
        return isinstance(value, list)
    if t == "string":
        return isinstance(value, str)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "boolean":
        return isinstance(value, bool)
    if t == "null":
        return value is None
    raise ValueError("unknown type " + t)


def validate(value, schema, root=None, path="$"):
    """Return a list of 'path: message' strings (empty when valid)."""
    root = root if root is not None else schema
    if "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/$defs/"):
            return ["%s: unsupported $ref %s" % (path, ref)]
        return validate(value, root["$defs"][ref[len("#/$defs/"):]], root, path)
    errs = []
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_type_ok(value, t) for t in types):
            return ["%s: expected %s" % (path, " or ".join(types))]
    if "const" in schema and value != schema["const"]:
        errs.append("%s: must be %r" % (path, schema["const"]))
    if "enum" in schema and value not in schema["enum"]:
        errs.append("%s: must be one of %s" % (path, schema["enum"]))
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errs.append("%s: must not be empty" % path)
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errs.append("%s: %r doesn't match %s" % (path, value, schema["pattern"]))
    if isinstance(value, (int, float)) and not isinstance(value, bool) and "minimum" in schema and value < schema["minimum"]:
        errs.append("%s: must be >= %s" % (path, schema["minimum"]))
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errs.append("%s: needs at least %d items" % (path, schema["minItems"]))
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errs.append("%s: at most %d items" % (path, schema["maxItems"]))
        if "items" in schema:
            for i, v in enumerate(value):
                errs += validate(v, schema["items"], root, "%s[%d]" % (path, i))
    if isinstance(value, dict):
        props = schema.get("properties", {})
        pats = schema.get("patternProperties", {})
        for k in schema.get("required", []):
            if k not in value:
                errs.append("%s: missing required '%s'" % (path, k))
        for k, v in value.items():
            sub = path + "." + k
            if k in props:
                errs += validate(v, props[k], root, sub)
                continue
            matched = [p for p in pats if re.search(p, k)]
            for p in matched:
                errs += validate(v, pats[p], root, sub)
            if matched:
                continue
            extra = schema.get("additionalProperties", True)
            if extra is False:
                errs.append("%s: unexpected key '%s'" % (path, k))
            elif isinstance(extra, dict):
                errs += validate(v, extra, root, sub)
    if "oneOf" in schema:
        results = [validate(value, s, root, path) for s in schema["oneOf"]]
        ok = [r for r in results if not r]
        if len(ok) != 1:
            if not ok:
                best = min(results, key=len)
                errs.append("%s: matches none of the allowed shapes (closest: %s)" % (path, best[0] if best else "?"))
            else:
                errs.append("%s: matches more than one allowed shape" % path)
    return errs


if __name__ == "__main__":
    import glob
    import sys
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(root, "levels", "*.json")))
    schema = load_schema()
    failed = 0
    for path in files:
        with open(path, encoding="utf-8") as f:
            errs = validate(json.load(f), schema)
        print("%s: %s" % (os.path.relpath(path, root), "ok" if not errs else "%d error(s)" % len(errs)))
        for e in errs:
            print("  " + e)
        failed += bool(errs)
    sys.exit(1 if failed else 0)
