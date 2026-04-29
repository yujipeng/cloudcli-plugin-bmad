import type { MethodologyItem, MethodologyCategory, MethodologyPriority } from './types.js';

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function col(fields: string[], index: number): string {
  return (fields[index] ?? '').trim();
}

function parsePriority(raw: string): MethodologyPriority {
  const v = raw.toLowerCase();
  if (v === 'true') return 'required';
  if (v === 'recommended') return 'recommended';
  return 'optional';
}

// New 13-column format: module,skill,display-name,menu-code,description,action,args,phase,after,before,required,output-location,outputs
export function parseMethodologyCsv(csvContent: string): MethodologyItem[] {
  const cleaned = csvContent.replace(/^﻿/, '');
  const lines = cleaned.split('\n').map(l => l.replace(/\r$/, ''));
  const items: MethodologyItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && line.startsWith('module,')) continue;

    const fields = parseCsvLine(line);
    const skill = col(fields, 1);
    if (skill === '_meta') continue;
    if (!skill) continue;

    const module = col(fields, 0);
    const phase = col(fields, 7);
    const isAgent = skill.startsWith('bmad-agent-');
    const agentName = isAgent ? skill : '';
    const normalizedPhase = isAgent ? 'agent' : (phase || 'anytime');
    const priority = parsePriority(col(fields, 10));
    const category: MethodologyCategory = isAgent ? 'agent' : (skill ? 'workflow' : 'tool');

    items.push({
      skill,
      displayName: col(fields, 2) || '',
      menuCode: col(fields, 3) || '',
      description: col(fields, 4) || '',
      required: priority === 'required',
      priority,
      category,
      phase: normalizedPhase,
      module,
      agentName,
    });
  }

  return items;
}
