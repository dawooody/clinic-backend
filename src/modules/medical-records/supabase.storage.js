const { createClient } = require('@supabase/supabase-js');

const MEDICAL_FILES_BUCKET = 'Clinic-App';
const VOICE_FILES_BUCKET = process.env.SUPABASE_VOICE_BUCKET || 'medical-files';
let supabaseClient;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getSupabaseClient = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw createHttpError(500, 'Supabase storage configuration is missing.');
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  return supabaseClient;
};

const getStorageFileUrl = (bucketName, storagePath) => {
  const client = getSupabaseClient();
  const { data } = client.storage.from(bucketName).getPublicUrl(storagePath);
  return data.publicUrl;
};

const uploadStorageFile = async ({ bucketName, storagePath, buffer, contentType }) => {
  const client = getSupabaseClient();
  const { error } = await client.storage.from(bucketName).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw createHttpError(500, `Failed to upload file to ${bucketName}: ${error.message}`);
  }

  return {
    fileUrl: getStorageFileUrl(bucketName, storagePath),
    storagePath,
  };
};

const uploadMedicalFile = async ({ storagePath, buffer, contentType }) => {
  return uploadStorageFile({
    bucketName: MEDICAL_FILES_BUCKET,
    storagePath,
    buffer,
    contentType,
  });
};

const downloadMedicalFileBuffer = async (storagePath) => {
  const client = getSupabaseClient();
  const { data, error } = await client.storage.from(MEDICAL_FILES_BUCKET).download(storagePath);

  if (error || !data) {
    throw createHttpError(404, `Medical file not found: ${storagePath}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const deleteMedicalFile = async (storagePath) => {
  if (!storagePath) {
    return;
  }

  await deleteStorageFile({
    bucketName: MEDICAL_FILES_BUCKET,
    storagePath,
  });
};

const deleteStorageFile = async ({ bucketName, storagePath }) => {
  if (!storagePath) {
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.storage.from(bucketName).remove([storagePath]);

  if (error) {
    throw createHttpError(500, `Failed to delete file from ${bucketName}: ${error.message}`);
  }
};

module.exports = {
  MEDICAL_FILES_BUCKET,
  deleteMedicalFile,
  deleteStorageFile,
  downloadMedicalFileBuffer,
  getStorageFileUrl,
  uploadStorageFile,
  uploadMedicalFile,
  VOICE_FILES_BUCKET,
};
