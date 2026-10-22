import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

data = pd.read_csv('Best Songs on Spotify from 2000-2023.csv', sep=';')

df = pd.DataFrame(data)

# Select the song you want to find similar songs for
selected_song = {
    'title': 'Flowers',
    'bpm': 118,
    'energy': 68,
    'danceability': 71,
    'dB': -4,
    'liveness': 3,
    'valence': 65,
    'duration': 200,
    'acousticness': 6,
    'speechiness': 7,
    'popularity': 98
}

# Calculate cosine similarity for acoustic features
acoustic_features = ['bpm', 'energy', 'danceability ', 'dB', 'liveness', 'valence', 'duration', 'acousticness', 'speechiness ', 'popularity']

# Normalize acoustic features
for feature in acoustic_features:
    df[feature] = (df[feature] - df[feature].min()) / (df[feature].max() - df[feature].min())

# Create a vector for the selected song
selected_song_vector = df[df['title'] == selected_song['title']][acoustic_features].values

# Calculate cosine similarity
df['similarity'] = cosine_similarity(df[acoustic_features], selected_song_vector).flatten()

# Sort by similarity and recommend similar songs
recommended_songs = df.sort_values(by='similarity', ascending=False)[['title', 'artist', 'similarity']]

# Print recommended songs
print("Recommended Songs:")
print(recommended_songs.head())





