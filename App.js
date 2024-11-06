// imports and initial setup
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, FlatList, StyleSheet, TextInput, Alert, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { TouchableOpacity } from 'react-native';
import trackerData from './tracker.json'                  // get json file

//state management
const App = () => {
  const [isStudying, setIsStudying] = useState(false);
  const [task, setTask] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [sessions, setSessions] = useState([]);

  //define rotation animated value 
  const rotation = useRef(new Animated.Value(0)).current 

  //loading previously stored sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const savedSessions = await AsyncStorage.getItem('sessions');    //retrieve data fro asyncstorage
        if (savedSessions) {
          setSessions(JSON.parse(savedSessions))                         //if sessions exist, load them into state
        }

        //load tracker.json file 
        const importedData = trackerData || [];
        const allSessions = [...importedData, ...JSON.parse(savedSessions || '[]')]

        setSessions(allSessions)

      } catch (error) {
        console.log('Error Loading Sessions:', error)
      }
    };

    loadSessions();
  }, [])

  //starting and ending study sessions
  const startSession = () => {
    console.log("Start session function called")
    if(!task) {
      Alert.alert("Task required","Please enter a task!");
      return;
    }

    console.log("Starting timer...")
    setIsStudying(true);                                                 // set the user as studying
    setStartTime(new Date());                                            // record the start time
  
    //rotate hourglass animation
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000, 
        useNativeDriver: false,
      })
    ).start();
  
  };

  const endSession = async () => {
    console.log("End session function is called")
    const endTime = new Date();                                          // record the end time
    const duration = (endTime - startTime) / 1000 / 60;
    const newSession = {
      start: startTime, 
      end: endTime,
      duration: duration.toFixed(2),
      task: task,
    };

    const updatedSessions = [...sessions, newSession];                   // add new sessions to the list
    setSessions(updatedSessions);                                        // update state with new session
    setIsStudying(false);                                                // set user as not studying anymore
    setTask('')                                                          // reset task input

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

  //function to delete a session
  const deleteSession = async (index) => {
    const updatedSessions = sessions.filter((_,i) => i !== index);
    setSessions(updatedSessions);
    await AsyncStorage.setItem('session', JSON.stringify(updatedSessions));  // Update asyncstorage after deletion
  }

  //handle date formatting
  const formatDate = (dateStr) => {

    if(!dateStr) {
      return '';
    }

    //check if the date s in yyyy/mm/dd format
    const dateParts = dateStr.split('/');

    if(dateParts.length === 3) {
      const [year, month, day] = dateParts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2,'0')}`;
    }
    return '';
  }

  // calculate study time per day for heat map
  const calculateStudyByDate = (sessions) => {
    const dateMap = {};

    sessions.forEach((session) => {
      const date = formatDate(session.Date || new Date(session.start).toISOString().split('T')[0]);     // extract the date (YYYY-MM-DD)

      if (dateMap[date]) {
        dateMap[date] += parseFloat(session.duration || 0);                      // Add duration if data exists
      } else {
        dateMap[date] = parseFloat(session.duration || 0);                       // Initialize the date
      }
    });
    return dateMap;
  };

  const studyByDate = calculateStudyByDate(sessions)                        // calculate the hours studied per date

  //calculate rotation interpolation
  const rotateInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  })

  // rendering the calendar and list of sessions
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Study Tracker</Text>

      <TextInput
        style={styles.input}
        placeholder='Enter Task'
        value={task}
        onChangeText={setTask}
      />

      {/* start/edn button */}
      <TouchableOpacity
        onPress={isStudying ? endSession : startSession}
        style={{
          backgroundColor: isStudying ? 'red' : 'green',
          padding: 10,
          borderRadius: 5, 
          margin: 10,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center'

        }}
      > 
        {isStudying && (
          <Animated.View style={{ transform: [{ rotate: rotateInterpolation }], marginRight: 8}}>
            <Icon name='hourglass-half' size={15} color='white'/>
          </Animated.View>
        )}
        <Text style={{ color: 'white', marginLeft: isStudying ? 8 : 0 }}>
          {isStudying ? 'End Study Session' : 'Start Study Session'}
        </Text>
        
      </TouchableOpacity>

      {/* Display total duration of studying*/}
      <Text style={styles.totalDuration}>
        Total Study Duration: {calculateStudyDuration()} minutes
      </Text>
      
      {/*color code calendar based on intensity levels*/}
      <Calendar 
        markedDates={Object.keys(studyByDate).reduce((acc, date) => {
          const hoursStudied = studyByDate[date];
          let backgroundColor;

          if (hoursStudied >=3) {
            backgroundColor = 'rgba(0, 100, 0, 1)';
          } else if (hoursStudied >=1) {
            backgroundColor = 'rgba(0, 255, 0, 0.7)'
          } else {
            backgroundColor = 'rgba(0, 255, 0, 0.3)'
          }

          acc[date] = {
            customStyles: {
              container: {
                backgroundColor: backgroundColor,
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
            <Text>Task: {item.task}</Text>
            <TouchableOpacity onPress={() => deleteSession(index)}>
              <Text style={styles.deleteButton}>Delete</Text>
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
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    color: 'white'
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