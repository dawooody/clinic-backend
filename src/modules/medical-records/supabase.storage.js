const { createClient } = require('@supabase/supabase-js');

const MEDICAL_FILES_BUCKET = 'Clinic-App';
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

const getMedicalFileUrl = (storagePath) => {
  const client = getSupabaseClient();
  const { data } = client.storage.from(MEDICAL_FILES_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
};

const uploadMedicalFile = async ({ storagePath, buffer, contentType }) => {
  const client = getSupabaseClient();
  const { error } = await client.storage.from(MEDICAL_FILES_BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw createHttpError(500, `Failed to upload medical file: ${error.message}`);
  }

  return {
    fileUrl: getMedicalFileUrl(storagePath),
    storagePath,
  };
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

  const client = getSupabaseClient();
  const { error } = await client.storage.from(MEDICAL_FILES_BUCKET).remove([storagePath]);

  if (error) {
    throw createHttpError(500, `Failed to delete medical file: ${error.message}`);
  }
};

module.exports = {
  MEDICAL_FILES_BUCKET,
  deleteMedicalFile,
  downloadMedicalFileBuffer,
  getMedicalFileUrl,
  uploadMedicalFile,
};
