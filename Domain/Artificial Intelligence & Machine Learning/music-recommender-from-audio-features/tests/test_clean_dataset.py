import pandas as pd

pd.set_option('display.max_rows', None)

# Configure Dataset
data = pd.read_csv('Best Songs on Spotify from 2000-2023.csv', sep = ";")
df = pd.DataFrame(data)
df = df.drop_duplicates(subset=["title"],keep="first")


df['title'] = df['title'].str.lower()
df['artist'] = df['artist'].str.lower()


