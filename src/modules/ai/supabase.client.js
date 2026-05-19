const { createClient } = require('@supabase/supabase-js');

let supabase;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getSupabaseClient = () => {
  if (supabase) {
    return supabase;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw createHttpError(500, 'Supabase configuration is missing.');
  }

  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  return supabase;
};

module.exports = {
  getSupabaseClient,
};
