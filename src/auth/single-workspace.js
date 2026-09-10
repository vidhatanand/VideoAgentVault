import {createAuth} from './service.js';
import {fail} from '../util.js';
export {SCOPES,roles} from './service.js';

// Each factory belongs to one application, never a mutable global workspace selector.
export function singleWorkspaceAuth(workspaceId) {
  if (!/^t_[a-zA-Z0-9_-]{1,100}$/.test(workspaceId || '')) throw new Error('SINGLE_WORKSPACE_ID_REQUIRED');
  async function beforeAuth(c) {
    const rows = await c.db.all('SELECT id FROM tenants LIMIT 2');
    if (rows.length !== 1 || rows[0].id !== workspaceId) fail(503,'INSTALLATION_WORKSPACE_MISMATCH');
    if (c.actor?.super) fail(403,'PLATFORM_IDENTITY_NOT_SUPPORTED');
    if (c.actor?.type === 'key' && c.actor.tenantId !== workspaceId) fail(403,'WORKSPACE_MISMATCH');
  }
  async function authorizeWorkspace(c, requested) {
    if (requested !== workspaceId) fail(403,'WORKSPACE_MISMATCH');
  }
  const auth = createAuth({beforeAuth, authorizeWorkspace});
  return Object.freeze({...auth, workspaceId});
}
