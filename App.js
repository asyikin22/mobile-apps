// imports and initial setup
import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { TouchableOpacity } from 'react-native';

//state management
const App = () => {
  const [isStudying, setIsStudying] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [sessions, setSessions] = useState([]);

  //loading previously stored sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const savedSessions = await AsyncStorage.getItem('sessions');    //retrieve data fro asyncstorage
        if (savedSessions) {
          setSessions(JSON.parse(savedSessions))                         //if sessions exist, load them into state
        }
      } catch (error) {
        console.log('Error Loading Sessions:', error)
      }
    };

    loadSessions();
  }, [])

  //starting and ending study sessions
  const startSession = () => {
    setIsStudying(true);                                                 // set the user as studying
    setStartTime(new Date());                                            // record the start time
  };

  const endSession = async () => {
    const endTime = new Date();                                          // record the end time
    const duration = (endTime - startTime) / 1000 / 60;
    const newSession = {
      start: startTime, 
      end: endTime,
      duration: duration.toFixed(2)
    };

    const updatedSessions = [...sessions, newSession];                   // add new sessions to the list
    setSessions(updatedSessions);                                        // update state with new session
    setIsStudying(false);                                                // set user as not studying anymore

    try {
      await AsyncStorage.setItem('sessions', JSON.stringify(updatedSessions));         // save update session to asyncstorage 
    } catch (error) {
      console.log('Error Saving Sessions:', error);
    }
  };

  //function to calculate study duration
  const calculateStudyDuration = () => {
    return sessions.reduce((total, session) => total + parseFloat(session.duration), 0).toFixed(2)
  }

  //function to delete a sessionl
  const deleteSession = async (index) => {
    const updatedSessions = sessions.filter((_,i) => i !== index)
    setSessions(updatedSessions)
  }

  // calculate study time per day for heat map
  const calculateStudyByDate = (sessions) => {
    const dateMap = {};

    sessions.forEach((session) => {
      const date = new Date(session.start).toISOString().split('T')[0];     // extract the date (YYYY-MM-DD)
      if (dateMap[date]) {
        dateMap[date] += parseFloat(session.duration);                      // Add duration if data exists
      } else {
        dateMap[date] = parseFloat(session.duration);                       // Initialize the date
      }
    });

    return dateMap;
  };

  const studyByDate = calculateStudyByDate(sessions)                        // calculate the hours studied per date

  // rendering the calendar and list of sessions
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Study Tracker</Text>
      {isStudying ? (
        <Button title="End Study Session" onPress={endSession}/>
      ) : (
        <Button title="Start Study Session" onPress={startSession}/>
      )}

      {/* Display total duration of studying*/}
      <Text style={styles.totalDuration}>
        Total Study Duration: {calculateStudyDuration()} minutes
      </Text>

      <Calendar 
        markedDates={Object.keys(studyByDate).reduce((acc, date) => {
          const intensity = Math.min(1, studyByDate[date] / 4);
          acc[date] = {
            customStyles: {
              container: {
                backgroundColor: `rgba(0, 100, 0, ${intensity})`,
              },
              text: {
                color: 'white',
              },
            },
          };
          return acc;
        }, {})}
        markingType={'custom'}
      />

      <FlatList 
        data={sessions}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({item}) => (
          <View style={styles.sessionItem}> 
            <Text>Start: {new Date(item.start).toLocaleString()}</Text>
            <Text>Duration: {item.duration} minutes</Text>
            <TouchableOpacity onPress={() => deleteSession(index)}>
              <Text style={styles.deleteButton}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

// style the app
const styles = StyleSheet.create({
  container: {
    flex: 1, 
    padding: 20,
    backgroundColor: '#001F3F',
  },
  totalDuration: {
    fontSize: 15,
    fontWeight: 'bold',
    marginVertical: 10,
    color: 'yellow',
  },
  header: {
    fontSize: 24, 
    fontWeight: 'bold',
    marginBottom: 20,
    color: 'white',
    textAlign: 'center'
  },
  sessionItem: {
    marginVertical: 10,
    padding: 10, 
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  deleteButton: {
    color: 'red',
    marginTop: 5,
  }
});

export default App;