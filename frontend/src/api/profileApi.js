import api from "./axios";


export const updateMyProfile = async (
  payload
) => {
  const response =
    await api.patch(
      "/auth/profile",
      payload
    );

  return response.data;
};


export const uploadMyProfilePhoto = async ({
  contentType,
  dataBase64,
}) => {
  const response =
    await api.put(
      "/auth/profile-photo",
      {
        content_type:
          contentType,
        data_base64:
          dataBase64,
      }
    );

  return response.data;
};


export const removeMyProfilePhoto =
  async () => {
    await api.delete(
      "/auth/profile-photo"
    );
  };
