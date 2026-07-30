import {
  getModelHealth,
  getModelInfo,
  reloadModel,
  resetModelState,
  trainModel,
} from "../../../services/anomalyModelService.js";

export const machineModelHealth = async (req, res, next) => {
  try {
    const result = await getModelHealth();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const machineModelInfo = async (req, res, next) => {
  try {
    const result = await getModelInfo();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const trainMachineModel = async (req, res, next) => {
  try {
    const result = await trainModel();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const reloadMachineModel = async (req, res, next) => {
  try {
    const result = await reloadModel();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const resetMachineModelState = async (req, res, next) => {
  try {
    const result = await resetModelState();
    res.json(result);
  } catch (error) {
    next(error);
  }
};
