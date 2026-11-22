import api from "./axios";


export const getClientSystemSettings = async () => {
  const response = await api.get(
    "/system-settings/client"
  );

  return response.data;
};


export const getSystemSettings = async () => {
  const response = await api.get(
    "/system-settings/"
  );

  return response.data;
};


export const updateGeneralSystemSettings = async (
  payload
) => {
  const response = await api.put(
    "/system-settings/general",
    payload
  );

  return response.data;
};


export const updateBackupSchedule = async (
  payload
) => {
  const response = await api.put(
    "/system-settings/backup-schedule",
    payload
  );

  return response.data;
};


export const getRolePermissionCatalog = async () => {
  const response = await api.get(
    "/system-settings/role-permissions"
  );

  return response.data;
};


export const updateRolePermissions = async (
  roleId,
  permissionCodes
) => {
  const response = await api.put(
    `/system-settings/roles/${roleId}/permissions`,
    {
      permission_codes: permissionCodes,
    }
  );

  return response.data;
};
