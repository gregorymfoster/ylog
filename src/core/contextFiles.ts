/**
 * Context file generation for .ylog files throughout the codebase
 */

import { join, dirname, basename } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import type { ResolvedYlogConfig } from '../types/config.js';

/**
 * Enhanced PR record for context generation (from database.getPRsForContext())
 */
export type PRContextRecord = {
  number: number;
  title: string;
  body: string | null;
  author: string;
  createdAt: string;
  mergedAt: string | null;
  baseRefName: string;
  headRefName: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
    status: string;
    previous_filename: string | null;
  }>;
  summary?: {
    why: string;
    business_impact: string;
    technical_changes: string[];
    areas: string[];
    confidence_score: number;
  };
  labels: string[];
};

/**
 * Area detected from file paths with associated PRs
 */
export type CodeArea = {
  path: string;
  prs: PRContextRecord[];
  score: number; // How relevant this area is
};

/**
 * Generate context files throughout the codebase
 */
export const generateContextFiles = async (
  prs: PRContextRecord[],
  config: ResolvedYlogConfig
): Promise<{ generated: number; skipped: number }> => {
  if (!config.generateContextFiles) {
    return { generated: 0, skipped: 0 };
  }

  // Detect areas from PR file changes
  const areas = detectAreas(prs);
  let generated = 0;
  let skipped = 0;

  for (const [areaPath, areaPRs] of areas) {
    if (shouldGenerateFile(areaPath, areaPRs.length, config)) {
      await generateContextFile(areaPath, areaPRs, config);
      generated++;
    } else {
      skipped++;
    }
  }

  return { generated, skipped };
};

/**
 * Detect code areas from PR file changes
 */
export const detectAreas = (prs: PRContextRecord[]): Map<string, PRContextRecord[]> => {
  const areaMap = new Map<string, PRContextRecord[]>();

  for (const pr of prs) {
    if (!pr.files || pr.files.length === 0) continue;

    // Group files by directory depth
    const areaPaths = new Set<string>();
    
    for (const file of pr.files) {
      const filePath = file.path;
      
      // Get meaningful directory paths
      const pathParts = filePath.split('/');
      
      // Add different levels of directories
      for (let i = 1; i <= Math.min(pathParts.length - 1, 3); i++) {
        const areaPath = pathParts.slice(0, i).join('/');
        if (areaPath && !areaPath.includes('.')) {
          areaPaths.add(areaPath);
        }
      }
    }

    // Associate PR with all detected areas
    for (const areaPath of areaPaths) {
      if (!areaMap.has(areaPath)) {
        areaMap.set(areaPath, []);
      }
      areaMap.get(areaPath)!.push(pr);
    }
  }

  // Filter out areas with insufficient PRs and sort by relevance
  const filteredAreas = new Map<string, PRContextRecord[]>();
  
  for (const [areaPath, areaPRs] of areaMap) {
    if (areaPRs.length >= 2) { // Minimum 2 PRs to consider
      // Remove duplicates
      const uniquePRs = areaPRs.filter((pr, index, array) => 
        array.findIndex(p => p.number === pr.number) === index
      );
      filteredAreas.set(areaPath, uniquePRs);
    }
  }

  return filteredAreas;
};

/**
 * Check if we should generate a context file for this area
 */
export const shouldGenerateFile = (
  areaPath: string,
  prCount: number,
  config: ResolvedYlogConfig
): boolean => {
  // Must meet minimum threshold
  if (prCount < config.contextFileThreshold) {
    return false;
  }

  // Skip very generic paths
  if (areaPath === 'src' || areaPath === 'lib' || areaPath === '.') {
    return false;
  }

  // Skip hidden directories
  if (areaPath.includes('/.') || areaPath.startsWith('.')) {
    return false;
  }

  // Skip node_modules and similar
  if (areaPath.includes('node_modules') || areaPath.includes('dist') || areaPath.includes('build')) {
    return false;
  }

  return true;
};

/**
 * Generate a context file for a specific area
 */
export const generateContextFile = async (
  areaPath: string,
  prs: PRContextRecord[],
  config: ResolvedYlogConfig
): Promise<void> => {
  // Determine output directory
  const contextFilePath = join(areaPath, '.ylog');
  const contextDir = dirname(contextFilePath);
  
  // Ensure directory exists
  if (!existsSync(contextDir)) {
    mkdirSync(contextDir, { recursive: true });
  }

  // Format the context file content
  const content = formatContextFile(areaPath, prs, config);
  
  // Write the file
  writeFileSync(contextFilePath, content, 'utf8');
};

/**
 * Format context file content as markdown
 */
export const formatContextFile = (
  areaPath: string,
  prs: PRContextRecord[],
  config: ResolvedYlogConfig
): string => {
  // Sort PRs by date (most recent first)
  const sortedPRs = [...prs].sort((a, b) => 
    new Date(b.mergedAt || b.createdAt).getTime() - new Date(a.mergedAt || a.createdAt).getTime()
  );

  // Filter to recent history if configured
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - config.historyMonths);
  const recentPRs = sortedPRs.filter(pr => 
    new Date(pr.mergedAt || pr.createdAt) >= cutoffDate
  );

  const displayPRs = recentPRs.slice(0, 20); // Max 20 PRs

  const content = `# Context: ${areaPath}

> **Auto-generated context file** - Do not edit manually  
> Last updated: ${new Date().toISOString().split('T')[0]}  
> Generated by [ylog](https://github.com/graphite-dev/ylog)

## Recent Changes (${displayPRs.length} PRs, last ${config.historyMonths} months)

${displayPRs.map(pr => formatPREntry(pr, areaPath)).join('\n\n')}

${recentPRs.length > displayPRs.length ? `\n*...and ${recentPRs.length - displayPRs.length} more PRs*\n` : ''}

---

## Why this file exists

This context file helps developers understand the evolution of the \`${areaPath}\` area by summarizing relevant pull requests. It's especially useful for:

- **New team members** getting familiar with the codebase
- **Code reviews** requiring historical context  
- **AI coding assistants** that need to understand recent changes
- **Debugging** issues in this area of the code

## How to regenerate

\`\`\`bash
ylog sync                    # Update all context files
ylog generate ${areaPath}    # Regenerate just this area
\`\`\`

*Generated from ${prs.length} total PRs affecting this area.*
`;

  return content;
};

/**
 * Format a single PR entry for the context file
 */
const formatPREntry = (pr: PRContextRecord, areaPath: string): string => {
  const date = new Date(pr.mergedAt || pr.createdAt).toISOString().split('T')[0];
  const fileCount = pr.files?.length || 0;
  
  // Get files relevant to this area
  const relevantFiles = pr.files?.filter(file => 
    file.path.startsWith(areaPath + '/') || 
    file.path === areaPath ||
    dirname(file.path) === areaPath
  ) || [];

  const fileList = relevantFiles.length > 0 
    ? relevantFiles.slice(0, 5).map(f => `\`${basename(f.path)}\``).join(', ')
    : `${fileCount} files`;

  let entry = `### #${pr.number}: ${pr.title}\n`;
  entry += `**${date}** by @${pr.author} • ${fileList}`;
  
  if (relevantFiles.length > 5) {
    entry += ` and ${relevantFiles.length - 5} more`;
  }
  
  if (pr.summary?.why) {
    entry += `\n\n${pr.summary.why}`;
  } else if (pr.body && pr.body.length > 0 && pr.body.length < 200) {
    entry += `\n\n${pr.body}`;
  }

  if (pr.summary?.technical_changes && pr.summary.technical_changes.length > 0) {
    entry += `\n\n**Technical changes:** ${pr.summary.technical_changes.join(', ')}`;
  }

  return entry;
};