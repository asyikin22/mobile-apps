// imports and initial setup
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, FlatList, StyleSheet, TextInput, Alert, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { TouchableOpacity } from 'react-native';
import moment from 'moment';
import trackerData from './tracker.json'                  // get json file

//state management
const App = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isStudying, setIsStudying] = useState(false);
  const [task, setTask] = useState('');
  const [startTime, setStartTime] = useState(null);
  

  //define rotation animated value 
  const rotation = useRef(new Animated.Value(0)).current 

  //loading previously stored sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const savedSessions = await AsyncStorage.getItem('sessions');    //retrieve data fro asyncstorage
        const importedData = trackerData || [];

        //Parse tracker.json data
        const parsedImportedData = importedData.map((session) => {

          //format the date and time stirng into parseable format for JS date object
          const dateParts = session.Date.split('/');
          const formattedDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`

          //combine formatted date with start & end time strings
          const startStr = `${formattedDate} ${session.Start}`;
          const endStr = `${formattedDate} ${session.End}`;

          const startDate = new Date(startStr)
          const endDate = new Date(endStr)

          //if the end date is earlier than the start date, it means the session spans across days
          if (endDate < startDate) {
            endDate.setDate(endDate.getDate() + 1)
          }
          
          //check if start date and end date are valid 
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn(`Invalid date for session: ${JSON.stringify(session)}`);
            return null;
          }

          const duration = (endDate - startDate) / 1000 / 60;

          return {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            duration: duration.toFixed(2),
            task: session.Task,
            Date: startDate.toISOString().split('T')[0],
          }
        }).filter(Boolean);

        //parse saved sessions only if it's not null
        const parsedSavedSessions = savedSessions ? JSON.parse(savedSessions) : [];

        // combine imported and saved sessions
        const allSessions = [...parsedImportedData, ...parsedSavedSessions];

        setSessions(allSessions);
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
      Date: new Date().toISOString().split('T')[0],
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

   //Handle calendar date selection
   const onDayPress = (day) => {
    setSelectedDate(day.dateString)
  }

  //calcualte study duration
  const calculateStudyDurationForDay = (date) => {
      const filteredSessions = sessions.filter((session) => session.Date === date)
      const totalDuration = filteredSessions.reduce((total, session) => total + parseFloat(session.duration), 0)
      return totalDuration.toFixed(2);
  };

   //function to delete a session
   const deleteSession = async (index) => {
    const updatedSessions = sessions.filter((_,i) => i !== index);
    setSessions(updatedSessions);

    try { 
      await AsyncStorage.setItem('sessions', JSON.stringify(updatedSessions));                // Update asyncstorage after deletion
    } catch (error) {
      console.log('Error Saving Sessions:', error)
    }  
  };

  //function to calculate study duration & group by date
  const calculateStudyByDate = (sessions) => {
    const dateMap = {};
    sessions.forEach((session) => {
      const date = session.Date || new Date(session.start).toISOString().split('T')[0];        //ensure date  is in yy-mm-dd format
      dateMap[date] = dateMap[date] + parseFloat(session.duration || 0);
    });
    return dateMap;
  };
  const studyByDate = calculateStudyByDate(sessions)

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
        placeholderTextColor= "#ccc"
      />

      {/* start/end button */}
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

      {/* Display total duration for selected day*/}
      <Text style={styles.totalDuration}>
        Total Study Duration for {selectedDate}: {calculateStudyDurationForDay(selectedDate)} minutes
      </Text>
      
      {/*color code calendar based on intensity levels*/}
      <Calendar 
        onDayPress={onDayPress}
        markedDates={Object.keys(studyByDate).reduce((acc, date) => {
          const formattedDate = moment(date).format('YYYY-MM-DD');
          const hoursStudied = studyByDate[date] / 60;
          let backgroundColor;

          if (hoursStudied >=5) {
            backgroundColor = 'green';
          } else if (hoursStudied >=3) {
            backgroundColor = 'blue'
          } else if (hoursStudied > 0) {
            backgroundColor = 'yellow'
          } else {
            backgroundColor = 'transparent';              //no study
          }

          acc[formattedDate] = {
            customStyles: {
              container: { backgroundColor },
            },
            text: {
              color: hoursStudied > 0 ? 'white' : 'black',
              fontWeight: 'bold',
            }
          };
          return acc;
        }, {})}
        markingType={'custom'}
      />

      <FlatList 
        data={sessions.filter((session) => !selectedDate || session.Date === selectedDate)}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({item, index}) => {
          const startDate = new Date(item.start);
          const formattedStartTime = startDate.toLocaleString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
          return (
            <View style={styles.sessionItem}> 
            <Text>Task: {item.task || "No Task Available"}</Text>
            <Text>Duration: {item.duration} minutes</Text>
            <Text>{item.Date}</Text>
            <Text>Start Time: {formattedStartTime}</Text>
            <TouchableOpacity onPress={() => deleteSession(index)}>
              <Text style={styles.deleteButton}>Delete</Text>
            </TouchableOpacity>
          </View>
          );
        }}
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