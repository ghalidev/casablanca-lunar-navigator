"""Every parameter of the LASTLIGHT pipeline lives here. Each value is justified in docs/assumptions.md.

`PARAMS_REF` is a hash of this file's parameters; it is written into every output file so a number on the
site can be traced back to the exact settings that produced it.
"""
import hashlib
import json

# --- Moon and Sun ---------------------------------------------------------------------------------------
R_MOON_M = 1_737_400.0            # reference sphere of the LOLA DEM (heights are above it)
SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6_371.0
S0_WM2 = 1361.0                   # solar constant at 1 AU
AU_KM = 149_597_870.7

# --- Data -----------------------------------------------------------------------------------------------
DEM_20M_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"   # 80-90S, 20 m/px
DEM_240M_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF"  # 60-90S, 240 m/px
FRAME_NAME = "MOON_ME_DE421"

# --- Horizon --------------------------------------------------------------------------------------------
AZ_STEP_DEG = 0.5                 # 720 azimuths
MAX_RANGE_KM = 150.0
NEAR_RADIUS_KM = 30.0             # inside this radius the 20 m DEM is used, outside it the 240 m DEM
MASTS_M = (2.0, 10.0)
FINE_GRID_HALF_M = 800.0          # landing-error grid: +-800 m around the target
FINE_GRID_STEP_M = 40.0           # one horizon every 40 m

# --- Time -----------------------------------------------------------------------------------------------
SERIES_YEAR = 2027                # hourly series shipped to the web
SURVIVAL_YEARS = (2027, 2030)     # landing days considered (inclusive)
STEP_H = 1
SURVIVE_DAYS = 14
VISIBLE_FRAC = 0.5                # a body counts as "in view" when at least half its disk clears the horizon

# --- Generic lander (not any real vehicle; see docs/assumptions.md) ---------------------------------------
PANEL_FACES = 4                   # vertical faces at 0, 90, 180, 270 deg of yaw
PANEL_AREA_M2 = 0.75              # per face
PANEL_EFFICIENCY = 0.28
BATTERY_WH = 2500.0               # starts full
LOAD_W = 60.0                     # constant consumption (heaters and avionics lumped, no thermal model)
TILT_LIMIT_DEG = 15.0             # landing tilt beyond which the lander tips over and is lost
TILT_NOISE_DEG = 2.0              # rms tilt added to the local terrain slope (leg compliance, touchdown dynamics)

# --- Landing error --------------------------------------------------------------------------------------
LANDING_SIGMA_M = 200.0           # per axis; mean radial miss ~250 m, the figure published for Athena (IM-2)
N_DRAWS = 1000                    # Monte Carlo draws per landing day
SEED = 20271115

# --- Verdict --------------------------------------------------------------------------------------------
P_THRESHOLD = 0.95
MAX_SLIP_DAYS = 30
TOP_N = 10

SITE_IDS = [
    "peak-near-cabeus-b", "haworth", "malapert-massif", "mons-mouton-plateau", "mons-mouton",
    "nobile-rim-1", "nobile-rim-2", "de-gerlache-rim-2", "slater-plain",
]


def _params() -> dict:
    return {k: v for k, v in globals().items() if k.isupper() and not k.startswith("_")}


PARAMS_REF = hashlib.sha256(json.dumps(_params(), sort_keys=True, default=str).encode()).hexdigest()[:12]
