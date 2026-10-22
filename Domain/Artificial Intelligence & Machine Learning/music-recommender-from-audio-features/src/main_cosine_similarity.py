# Import Required Libraires
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import ipywidgets as widgets
from sklearn.metrics.pairwise import cosine_similarity


pd.set_option('display.max_rows', None)


# Configure Dataset
data = pd.read_csv('Best Songs on Spotify from 2000-2023.csv', sep = ";")
df = pd.DataFrame(data)
df = df.drop_duplicates(subset=["title"],keep="first")


df['title'] = df['title'].str.lower()
df['artist'] = df['artist'].str.lower()


# Count the number of popular songs for each artist and select the top 20
popular_songs_count = df['artist'].value_counts().head(20)

# Create a new figure for the bar plot with specified dimensions
plt.figure(figsize=(9, 6))

# Count popular songs on the x-axis and the artist names on the y-axis
sns.barplot(x=popular_songs_count.values, y=popular_songs_count.index, palette='deep')

# Add a title to the plot
plt.title('Number of Popular Songs by Top 20 Artists on Spotify from 2000-2023', fontsize=14)


# Enter the name of the artist
select_artist = str(input('Enter Artist: ')).lower()

# Check if the artist exists in the DataFrame
if df['artist'].str.contains(select_artist).any():
    # Filter the DataFrame for the selected artist
    selected_artist = df['artist'] == select_artist
    # New DataFrame with columns 'title', 'artist', and 'year'
    show_artist_song = df[selected_artist][['title', 'artist', 'year']]
    # Display the first 5 songs of the Artist
    print(show_artist_song.head(show_artist_song.shape[0]))
else:
    # Display message if Artist is not found in dataset
    print('Artist not in database')



# 5 hours
select_title = widgets.Dropdown(options = list(show_artist_song['title']), description = "select song")
select_title


select_title = select_title.value
select_song = show_artist_song['title'] == select_title
selected_song = show_artist_song[select_song]



# Select Acoustic Features for Cosine Similarity
acoustic_features = ['bpm', 'energy', 'danceability ', 'dB', 'liveness', 'valence', 'duration', 'acousticness', 'speechiness ', 'popularity']

# Normalize Acoustic Features: Have all points between [-1,1]
for feature in acoustic_features:
    df[feature] = (df[feature] - df[feature].min()) / (df[feature].max() - df[feature].min())
    
# Create a vector for the selected song
selected_song_vector = df[(df['artist'] == select_artist) & (df['title'] == select_title)][acoustic_features].values

# Calculate Cosine Similarity
df['similarity'] = cosine_similarity(df[acoustic_features], selected_song_vector)

# Sort by Similarity and Recommend similar songs
recommended_songs = df.sort_values(by='similarity', ascending=False)[['title', 'artist', 'similarity']]

# Print recommended songs
print("Recommended Songs:")
recommended_songs.head()



