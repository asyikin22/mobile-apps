// imports and initial setup
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, FlatList, StyleSheet, TextInput, Alert, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { TouchableOpacity } from 'react-native';
import moment, { duration } from 'moment';
import trackerData from './tracker.json'                  // get json file

//state management
const App = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
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
          const startStr = moment(`${session.Date} ${session.Start}`, 'YYYY-MM-DD hh:mm A');
          const endStr = moment(`${session.Date} ${session.End}`, 'YYYY-MM-DD hh:mm A');
          const duration = parseFloat(session.Duration_minutes) || 0;

          return {
            start: startStr.toISOString(),
            end: endStr.toISOString(),
            duration: duration,
            task: session.Task,
            Date: session.Date,
          }
        });

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
    const endTime = moment();                                          // record the end time
    const duration = endTime.diff(startTime, 'minutes');

    const newSession = {
      start: startTime.toISOString(), 
      end: endTime.toISOString(),
      duration: duration.toFixed(2),
      task: task,
      Date: moment().format('YYYY-MM-DD')
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

  //calcualte study duration for the selected day
  const calculateStudyDurationForDay = (date) => {
      const filteredSessions = sessions.filter((session) => session.Date === date)
      const totalDuration = filteredSessions.reduce((total, session) => total + session.duration, 0)
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
      const date = session.Date || moment(session.start).format('YYYY-MM-DD')   
      const duration = session.duration || 0;

      dateMap[date] = (dateMap[date] || 0) + duration;
    
    });
    return dateMap;
  };
  const studyByDate = calculateStudyByDate(sessions)

  //function to format the time to show AM/PM
  const formatStartTime = (start) => {
    const startDate = moment(start);
    return startDate.format('hh:mm A');
  }

  //calculate rotation interpolation
  const rotateInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  })

  //legend function
  const Legend = () => {
    return (
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, {backgroundColor: 'green'}]}></View>
          <Text style={styles.legendText}>5+ hours</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.colorBox, {backgroundColor: '#89CFF0'}]}></View>
          <Text style={styles.legendText}>3-5 hours</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.colorBox, {backgroundColor: 'lightcoral'}]}></View>
          <Text style={styles.legendText}>&lt; 3 hours</Text>
        </View>
      </View>
    )
  }

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
        Total:{" "} 
        <Text style={styles.highlightedValue}>
        {calculateStudyDurationForDay(selectedDate)} 
        </Text>{" "} 
        min on{" "}  
        <Text style={styles.highlightedValue}>
        {selectedDate}
        </Text>
      </Text>

      {/*Add legend*/}
      <Legend />
      
      {/*color code calendar based on intensity levels*/}
      <Calendar 
        onDayPress={onDayPress}
        markedDates={Object.keys(studyByDate).reduce((acc, date) => {
          const minutesStudied = studyByDate[date];
          const hoursStudied = minutesStudied / 60;

          let backgroundColor;
          if (hoursStudied >=5) {
            backgroundColor = 'green';
          } else if (hoursStudied >3) {
            backgroundColor = '#89CFF0'
          } else if (hoursStudied > 0) {
            backgroundColor = 'lightcoral'
          } else {
            backgroundColor = 'transparent';              //no study
          }

          acc[date] = {
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
          const formattedStartTime = formatStartTime(item.start);
          const formattedEndTime = formatStartTime(item.end)
          return (
            <View style={styles.sessionItem}> 
            <Text>Task: {item.task || "No Task Available"}</Text>
            <Text>Duration: {item.duration} minutes</Text>
            <Text>Date: {item.Date}</Text>
            <Text>Start Time: {formattedStartTime}</Text>
            <Text>End Time: {formattedEndTime}</Text>
            <TouchableOpacity onPress={() => deleteSession(index)}>
              <Icon name="trash" size={20} color="red" />
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
  highlightedValue: {
    color: 'fuchsia', 
    fontWeight: 'bold',
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
  },
  legendContainer: {
    marginVertical: 15,
    direction: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 5,
    backgroundColor: '#2C3E50',
    borderRadius: 8,
  }, 
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBox: {
    width: 20,
    height: 20,
    marginRight: 10,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    color: 'white',
  }
});

export default App;