import {
  getLatestSecurityAnalysis,
  getSecurityModelHealth,
} from "../../../services/securityModelService.js";

export const securityModelHealth = async (req, res, next) => {
  try {
    const result = await getSecurityModelHealth();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const latestSecurityAnalysis = async (req, res, next) => {
  try {
    const result = await getLatestSecurityAnalysis();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

