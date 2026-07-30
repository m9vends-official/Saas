import os
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pandas as pd
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "electric_anomaly.csv")
MODEL_PATH = os.path.join(BASE_DIR, "anomaly_model.pkl")
FEATURES = ["voltage", "current", "temperature"]
TARGET = "X"


def train():
    df = pd.read_csv(DATA_PATH)
    missing_columns = [column for column in [*FEATURES, TARGET] if column not in df.columns]
    if missing_columns:
        raise ValueError(f"Training data is missing columns: {', '.join(missing_columns)}")

    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
  
    classifier = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        class_weight="balanced",
    )
    classifier.fit(X_train, y_train)

    y_pred = classifier.predict(X_test)
    accuracy = float(accuracy_score(y_test, y_pred))
    report_text = classification_report(y_test, y_pred, zero_division=0)
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    matrix = confusion_matrix(y_test, y_pred).tolist()

    print("Accuracy:", accuracy)
    print(report_text)
    print(matrix)

    joblib.dump({"model": classifier, "features": FEATURES}, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")

    return {
        "model_path": MODEL_PATH,
        "data_path": DATA_PATH,
        "features": FEATURES,
        "target": TARGET,
        "rows": int(len(df)),
        "accuracy": accuracy,
        "classification_report": report,
        "confusion_matrix": matrix,
    }


if __name__ == "__main__":
    train()
