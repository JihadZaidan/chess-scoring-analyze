# ♟️ Chess Scoring & Analysis Web Application

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel)](https://chess-scoring-analyze.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Python/Node Match](https://img.shields.io/badge/Focus-Data%20Statistics-blue?style=flat-square)]()

An empirical dashboard and analytical tool designed to fetch, parse, and score chess matches from online platforms (such as Chess.com and Lichess). By implementing descriptive and inferential statistical methodologies, this web app provides players and researchers with actionable metrics on opening performance, rating volatility, and tactical consistency.

🌍 **Live Production Link:** [chess-scoring-analyze.vercel.app](https://chess-scoring-analyze.vercel.app/)

---

## 🚀 Key Features

*   **Multi-Platform Extraction:** Seamless ingestion of raw PGN data or direct profile lookups via standard API integrations.
*   **Dynamic Performance Scoring:** Advanced statistical mapping that quantifies move precision, error margins, and performance spikes.
*   **Exploratory Data Analysis (EDA):** Built-in data visualization engines rendering real-time scatter plots, box plots, and performance histograms.
*   **Inferential Engines:** Correlates rating fluctuations against specific variables (e.g., time controls, opening archetypes, and mistake frequencies).

---

## 📊 Data Schema & Core Variables

The application processes both categorical and continuous data parameters to calculate specialized scoring matrices:

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `Elo Rating` | Quantitative (Continuous) | Current numerical rank of the player/opponent. |
| `Accuracy Score` | Quantitative (Percentage) | Algorithmic move match percentage compared to engine depth. |
| `Time Control` | Categorical | Match formats (e.g., Bullet, Blitz, Rapid, Classical). |
| `Phase Evaluation` | Quantitative (Vector) | Positional score differentials broken down by Opening, Middlegame, and Endgame. |

---

## 📈 Statistical Methodologies Employed

### 1. Outlier Detection
To maintain dataset integrity (removing anomalous matches like early resignations or server disconnects), the app applies an Interquartile Range (IQR) filter to match duration and move count:
$$\text{Lower Bound} = Q_1 - 1.5 \times \text{IQR}$$
$$\text{Upper Bound} = Q_3 + 1.5 \times \text{IQR}$$

### 2. Regression & Optimization Models
The engine tests predictive models to gauge whether specific opening accuracy scores reliably forecast net rating gain ($Y$) utilizing ordinary least squares regression:
$$Y = \beta_0 + \beta_1X + \epsilon$$

---

## 🛠️ Technology Stack

*   **Frontend UI:** Next.js / React.js (optimized for Vercel deployment edge streaming)
*   **Styling:** Tailwind CSS / shadcn/ui components
*   **Data Processing:** Python (Pandas/NumPy) or JavaScript native arrays depending on engine choice
*   **Data Visualization:** Recharts / Chart.js

---

## 📦 Local Installation & Setup

Follow these steps to run the analysis engine locally:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/chess-scoring-analyze.git](https://github.com/YOUR_USERNAME/chess-scoring-analyze.git)
   cd chess-scoring-analyze
