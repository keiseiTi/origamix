import { invalid } from '../errors';

/** Owns short-lived host directory grants; paths never cross the HTTP boundary. */
export class DirectoryGrants {
  private readonly grants = new Map<string, string>();

  registerGrant(id: string, path: string): void {
    this.grants.set(id, path);
  }

  resolveGrant(id: string): string {
    const path = this.grants.get(id);
    if (!path) throw invalid('目录授权已失效，请重新选择目录');
    return path;
  }

  consumeGrant(id: string): string {
    const path = this.resolveGrant(id);
    this.grants.delete(id);
    return path;
  }
}
