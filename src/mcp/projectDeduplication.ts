import { SDPClient } from '../api/client.js';

interface Project {
  id: string;
  title: string;
  description?: string;
  status: string | { id: string; name: string };
  owner?: {
    name?: string;
    email?: string;
  };
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingProject?: Project;
  similarity?: number;
  reason?: string;
}

/**
 * Check for duplicate projects before creation
 */
export class ProjectDeduplicationService {
  constructor(private client: SDPClient) {}

  /**
   * Check if a project with similar title already exists
   */
  async checkForDuplicates(
    title: string,
    description?: string
  ): Promise<DuplicateCheckResult> {
    // Extract keywords from title
    const keywords = this.extractKeywords(title);
    
    // Search for each keyword
    const potentialDuplicates: Project[] = [];
    
    for (const keyword of keywords) {
      try {
        // Note: SDP API might not support search parameter
        // This is a placeholder for when search is available
        const results = await this.client.projects.list({
          per_page: 50,
          // search: keyword // If supported
        });
        
        potentialDuplicates.push(...results.data);
      } catch (error) {
        console.error(`Error searching for keyword ${keyword}:`, error);
      }
    }
    
    // Remove duplicates from results
    const uniqueProjects = this.deduplicateProjects(potentialDuplicates);
    
    // Check each project for similarity
    for (const project of uniqueProjects) {
      const similarity = this.calculateSimilarity(title, project.title);
      
      if (similarity > 0.8) {
        return {
          isDuplicate: true,
          existingProject: project,
          similarity,
          reason: `Found project "${project.title}" with ${Math.round(similarity * 100)}% title similarity`
        };
      }
      
      // Also check description similarity if provided
      if (description && project.description) {
        const descSimilarity = this.calculateSimilarity(
          description.toLowerCase(),
          project.description.toLowerCase()
        );
        
        if (descSimilarity > 0.7) {
          return {
            isDuplicate: true,
            existingProject: project,
            similarity: descSimilarity,
            reason: `Found project "${project.title}" with similar description`
          };
        }
      }
    }
    
    return { isDuplicate: false };
  }

  /**
   * Extract meaningful keywords from a title
   */
  private extractKeywords(title: string): string[] {
    // Remove common words
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    
    // Split and filter
    const words = title
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !stopWords.includes(word));
    
    // Also include acronyms
    const acronyms = title.match(/[A-Z]{2,}/g) || [];
    
    return [...new Set([...words, ...acronyms.map(a => a.toLowerCase())])];
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Exact match
    if (s1 === s2) return 1;
    
    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }

  /**
   * Remove duplicate projects from array
   */
  private deduplicateProjects(projects: Project[]): Project[] {
    const seen = new Set<string>();
    return projects.filter(project => {
      if (seen.has(project.id)) {
        return false;
      }
      seen.add(project.id);
      return true;
    });
  }

  /**
   * Get suggestions for handling duplicates
   */
  getSuggestions(
    existingProject: Project,
    newTitle: string
  ): string[] {
    const suggestions: string[] = [];
    
    // Get status name
    const statusName = typeof existingProject.status === 'string' 
      ? existingProject.status 
      : existingProject.status.name;
    
    // If project is completed, suggest creating new version
    if (statusName === 'Completed') {
      suggestions.push(
        `Create new project as "${newTitle} v2" since existing is completed`
      );
    }
    
    // If project is active, suggest updating
    if (['Open', 'In Progress', 'New'].includes(statusName)) {
      suggestions.push(
        `Update existing project ID ${existingProject.id} instead of creating new`
      );
    }
    
    // If project is on hold, suggest reactivating
    if (statusName === 'On Hold') {
      suggestions.push(
        `Reactivate project ID ${existingProject.id} instead of creating new`
      );
    }
    
    return suggestions;
  }
}