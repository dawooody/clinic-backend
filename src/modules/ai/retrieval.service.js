const { createClient } = require('@supabase/supabase-js');
const { generateEmbedding } = require('./embedding.helpers');
const { createSearchMessage, detectLanguage } = require('./language.helpers');
const { extractStructuredContentField } = require('./prompt.builders');
const { translateToEnglish } = require('./translation.helpers');

const SEARCH_RESULT_LIMIT = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.72;

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

const getSimilarityThreshold = (threshold) => {
  const configuredThreshold = threshold
    ?? process.env.AI_RAG_SIMILARITY_THRESHOLD
    ?? DEFAULT_SIMILARITY_THRESHOLD;
  const parsedThreshold = Number(configuredThreshold);

  if (Number.isNaN(parsedThreshold)) {
    return DEFAULT_SIMILARITY_THRESHOLD;
  }

  return parsedThreshold;
};

const normalizeSearchResult = (row) => {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const content = typeof row.content === 'string' ? row.content.trim() : '';
  const similarity = Number(row.similarity);
  const disease = typeof row.disease === 'string' && row.disease.trim()
    ? row.disease.trim()
    : extractStructuredContentField(content, 'Disease');
  const specialty = typeof row.specialty === 'string' && row.specialty.trim()
    ? row.specialty.trim()
    : extractStructuredContentField(content, 'Specialty');

  if (!content || !disease || Number.isNaN(similarity)) {
    return null;
  }

  return {
    disease,
    specialty: specialty || 'Unknown',
    content,
    similarity,
  };
};

const normalizeSearchOptions = (limitOrOptions, threshold) => {
  if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
    return {
      limit: Number(limitOrOptions.limit) || SEARCH_RESULT_LIMIT,
      threshold: getSimilarityThreshold(limitOrOptions.threshold),
    };
  }

  return {
    limit: Number(limitOrOptions) || SEARCH_RESULT_LIMIT,
    threshold: getSimilarityThreshold(threshold),
  };
};

const filterResultsBySimilarity = (results, threshold = getSimilarityThreshold()) => {
  return results
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
};

const vectorSearch = async (embedding, limit = SEARCH_RESULT_LIMIT) => {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client.rpc('match_documents', {
      query_embedding: embedding,
      match_count: limit,
    });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(normalizeSearchResult)
      .filter(Boolean)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error) {
    throw createHttpError(500, `Failed to search documents: ${error.message}`);
  }
};

const prepareRetrievalPipeline = async (message, options = {}) => {
  const originalMessage = message?.trim();

  if (!originalMessage) {
    throw createHttpError(400, 'Message is required.');
  }

  const limit = Number(options.limit) || SEARCH_RESULT_LIMIT;
  const similarityThreshold = getSimilarityThreshold(options.threshold);
  const detectedLanguage = detectLanguage(originalMessage);
  const requiresTranslation = detectedLanguage === 'ar';
  const searchMessage = requiresTranslation
    ? await translateToEnglish(originalMessage)
    : createSearchMessage(originalMessage, detectedLanguage);

  // Multilingual RAG flow:
  // originalMessage is preserved for the final user-facing answer.
  // searchMessage is the retrieval text. Arabic is translated to English before
  // embeddings because the current BGE model is English-only; embedding Arabic
  // directly would produce weaker pgvector matches.
  const embedding = await generateEmbedding(searchMessage);
  const retrievedResults = await vectorSearch(embedding, limit);
  const filteredResults = filterResultsBySimilarity(retrievedResults, similarityThreshold).slice(0, limit);

  return {
    detectedLanguage,
    originalMessage,
    requiresTranslation,
    searchMessage,
    retrievedResults,
    results: filteredResults,
    similarityThreshold,
  };
};

const retrieveSimilarDiseases = async (query, limit = SEARCH_RESULT_LIMIT) => {
  const pipeline = await prepareRetrievalPipeline(query, { limit, threshold: 0 });
  return pipeline.retrievedResults;
};

const searchDocuments = async (query, limitOrOptions = SEARCH_RESULT_LIMIT, threshold) => {
  const options = normalizeSearchOptions(limitOrOptions, threshold);
  const pipeline = await prepareRetrievalPipeline(query, options);
  return pipeline.results;
};

module.exports = {
  DEFAULT_SIMILARITY_THRESHOLD,
  SEARCH_RESULT_LIMIT,
  filterResultsBySimilarity,
  getSimilarityThreshold,
  prepareRetrievalPipeline,
  retrieveSimilarDiseases,
  searchDocuments,
  vectorSearch,
};
