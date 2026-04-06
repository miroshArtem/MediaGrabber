// File Operations
// Handles file system operations with proper error handling

import * as fs from 'fs';
import * as path from 'path';

export interface FileInfo {
  path: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isDirectory: boolean;
}

export class FileOperations {
  /**
   * Check if a path exists
   */
  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
  
  /**
   * Create a directory recursively
   */
  mkdir(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  /**
   * Remove a file
   */
  removeFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  /**
   * Remove a directory and its contents
   */
  removeDir(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true });
    }
  }
  
  /**
   * Get file information
   */
  getFileInfo(filePath: string): FileInfo | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      isDirectory: stats.isDirectory()
    };
  }
  
  /**
   * List files in a directory
   */
  listDir(dirPath: string): FileInfo[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    
    const files = fs.readdirSync(dirPath);
    return files.map(file => {
      const fullPath = path.join(dirPath, file);
      return this.getFileInfo(fullPath)!;
    }).filter(Boolean);
  }
  
  /**
   * Get available disk space
   */
  getFreeSpace(dirPath: string): number {
    // Platform-specific implementation
    if (process.platform === 'win32') {
      // Use drive letter from path
      try {
        const drive = path.parse(dirPath).root.split(':')[0] + ':';
        const { execSync } = require('child_process');
        const output = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace /value`, { encoding: 'utf8' });
        const match = output.match(/FreeSpace=(\d+)/);
        return match ? parseInt(match[1], 10) : -1;
      } catch {
        return -1;
      }
    } else {
      // Unix-like systems
      try {
        const { execSync } = require('child_process');
        const output = execSync(`df -k "${dirPath}" | tail -1`, { encoding: 'utf8' });
        const parts = output.split(/\s+/);
        return parseInt(parts[3], 10) * 1024; // Convert KB to bytes
      } catch {
        return -1;
      }
    }
  }
  
  /**
   * Move a file
   */
  moveFile(source: string, destination: string): void {
    fs.renameSync(source, destination);
  }
  
  /**
   * Copy a file
   */
  copyFile(source: string, destination: string): void {
    fs.copyFileSync(source, destination);
  }
  
  /**
   * Get the default download directory
   */
  getDefaultDownloadDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE;
    
    if (process.platform === 'win32') {
      return path.join(home!, 'Downloads');
    } else if (process.platform === 'darwin') {
      return path.join(home!, 'Downloads');
    } else {
      return path.join(home!, 'Downloads');
    }
  }
}
