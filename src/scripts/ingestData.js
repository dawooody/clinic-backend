require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DATA_FILE_PATH = path.resolve(__dirname, '..', 'Assets', 'final_cleaned_diseases.json');
const MODEL_NAME = 'Xenova/bge-base-en-v1.5';
const EMBEDDING_SIZE = 768;

const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY'];

let extractor;
let supabase;

const validateEnv = () => {
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
};

const normalizeValue = (value, fallback = 'unknown') => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const normalizeSymptoms = (symptoms) => {
  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return 'unknown';
  }

  const cleanedSymptoms = symptoms
    .map((symptom) => normalizeValue(symptom, ''))
    .filter(Boolean);

  return cleanedSymptoms.length > 0 ? cleanedSymptoms.join(', ') : 'unknown';
};

const formatDiseaseRecord = (record) => {
  const disease = normalizeValue(record?.disease);
  const symptoms = normalizeSymptoms(record?.symptoms);
  const specialty = normalizeValue(record?.specialty);
  const urgency = normalizeValue(record?.urgency);

  return `Disease: ${disease}. Symptoms: ${symptoms}. Specialty: ${specialty}. Urgency: ${urgency}.`;
};

const formatEmbeddingForPgVector = (embedding) => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Embedding response is empty or invalid.');
  }

  return `[${embedding.join(',')}]`;
};

const initializeExtractor = async () => {
  if (extractor) {
    return extractor;
  }

  const { pipeline } = await import('@xenova/transformers');

  extractor = await pipeline('feature-extraction', MODEL_NAME);
  return extractor;
};

const getEmbedding = async (text) => {
  if (!extractor) {
    throw new Error('Embedding extractor is not initialized.');
  }

  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });

  const embedding = Array.from(output.data);

  if (embedding.length !== EMBEDDING_SIZE) {
    throw new Error(`Expected embedding size ${EMBEDDING_SIZE}, received ${embedding.length}.`);
  }

  return embedding;
};

const insertDocument = async ({ disease, specialty, content, embedding }) => {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }

  const { error } = await supabase.from('documents').insert({
    disease,
    specialty,
    content,
    embedding: formatEmbeddingForPgVector(embedding),
  });

  if (error) {
    throw error;
  }
};

const readDiseaseData = async () => {
  const fileContents = await fs.readFile(DATA_FILE_PATH, 'utf-8');
  const parsedData = JSON.parse(fileContents);

  if (!Array.isArray(parsedData)) {
    throw new Error('Disease data file must contain an array of records.');
  }

  return parsedData;
};

const ingestDiseaseRecord = async (record) => {
  const diseaseName = normalizeValue(record?.disease);
  const specialty = normalizeValue(record?.specialty);
  const content = formatDiseaseRecord(record);
  const embedding = await getEmbedding(content);

  await insertDocument({
    disease: diseaseName,
    specialty,
    content,
    embedding,
  });
  console.log(`Inserted: ${diseaseName}`);
};

const main = async () => {
  validateEnv();

  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  console.log(`Loading local embedding model: ${MODEL_NAME}`);
  await initializeExtractor();

  console.log(`Reading disease data from ${DATA_FILE_PATH}...`);
  const diseases = await readDiseaseData();
  console.log(`Found ${diseases.length} disease records. Starting sequential ingestion...`);

  let successCount = 0;
  let failureCount = 0;

  for (const record of diseases) {
    try {
      await ingestDiseaseRecord(record);
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      const diseaseName = normalizeValue(record?.disease);
      console.error(`Failed to ingest "${diseaseName}": ${error.message}`);
    }
  }

  console.log(`Ingestion completed. Success: ${successCount}, Failed: ${failureCount}.`);
};

main().catch((error) => {
  console.error(`Ingestion script failed to start: ${error.message}`);
  process.exitCode = 1;
});
