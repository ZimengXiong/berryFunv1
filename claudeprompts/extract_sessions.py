#!/usr/bin/env python3
"""Extract Claude session user prompts only (no logs)."""

import json
import re
from datetime import datetime
from pathlib import Path

SESSION_DIR = Path.home() / ".claude/projects/-Users-zimengx-Projects-berryFunv1"
OUTPUT_DIR = Path("/Users/zimengx/Projects/berryFunv1/claudeprompts")

def extract_text_content(content):
    """Extract text from message content (can be string or list)."""
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        texts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    text = item.get("text", "")
                    # Skip tool-related messages
                    if not text.startswith("[Request interrupted") and not text.startswith("[Tool"):
                        texts.append(text)
        return "\n".join(texts)
    return ""

def is_real_user_prompt(data, content_text):
    """Check if this is a real user prompt (not tool result or system message)."""
    if data.get("type") != "user":
        return False

    message = data.get("message", {})
    content = message.get("content", "")

    # Skip tool results
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "tool_result":
                return False

    # Skip empty or very short
    if not content_text or len(content_text.strip()) < 2:
        return False

    # Skip interruption messages
    if content_text.startswith("[Request interrupted"):
        return False

    return True

def process_session(jsonl_path):
    """Process a single session JSONL file, extracting only user prompts."""
    prompts = []
    session_info = {}

    with open(jsonl_path, 'r') as f:
        for line in f:
            try:
                data = json.loads(line.strip())

                # Get session info from first message
                if not session_info and data.get("sessionId"):
                    session_info = {
                        "sessionId": data.get("sessionId", ""),
                        "slug": data.get("slug", ""),
                        "gitBranch": data.get("gitBranch", ""),
                        "version": data.get("version", ""),
                    }

                message = data.get("message", {})
                content = message.get("content", "")
                timestamp = data.get("timestamp", "")

                text = extract_text_content(content)

                if is_real_user_prompt(data, text):
                    prompts.append({
                        "content": text.strip(),
                        "timestamp": timestamp
                    })
            except json.JSONDecodeError:
                continue

    return prompts, session_info

def write_session_md(prompts, session_info, output_path):
    """Write session prompts to markdown file."""
    with open(output_path, 'w') as f:
        f.write(f"# Session: {session_info.get('slug', 'Unknown')}\n\n")
        f.write(f"**Session ID**: `{session_info.get('sessionId', 'Unknown')}`\n\n")
        f.write("---\n\n")
        f.write("## User Prompts\n\n")

        for i, prompt in enumerate(prompts, 1):
            timestamp = prompt["timestamp"]
            content = prompt["content"]

            # Format timestamp
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                time_str = dt.strftime("%Y-%m-%d %H:%M")
            except:
                time_str = ""

            f.write(f"### {i}. {time_str}\n\n")
            f.write(f"{content}\n\n")

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Find all session JSONL files
    session_files = list(SESSION_DIR.glob("*.jsonl"))

    print(f"Found {len(session_files)} session files")

    for jsonl_path in session_files:
        session_id = jsonl_path.stem
        print(f"Processing: {session_id}")

        prompts, session_info = process_session(jsonl_path)

        if prompts:
            output_path = OUTPUT_DIR / f"{session_id}.md"
            write_session_md(prompts, session_info, output_path)
            print(f"  -> Wrote {len(prompts)} prompts to {output_path.name}")
        else:
            print(f"  -> No prompts found")

    print(f"\nPrompts written to: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
