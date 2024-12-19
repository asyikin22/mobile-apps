// imports and initial setup
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, FlatList, StyleSheet, TextInput, Alert, Animated, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; 
import { Calendar } from 'react-native-calendars';
import { TouchableOpacity } from 'react-native';
import moment from 'moment';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '@env';

// console.log("URL:", SUPABASE_URL);
// console.log("KEY:", SUPABASE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

//get screen width
const screenWidth = Dimensions.get('window').width;

//state management
const App = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [isStudying, setIsStudying] = useState(false);
  const [task, setTask] = useState('');
  const [startTime, setStartTime] = useState(null);
  
  //define rotation animated value 
  const rotation = useRef(new Animated.Value(0)).current 

  //fetch sessions from supabase
  const fetchSessionsFromSupabase = async () => {
    const { data, error } = await supabase
      .from('tracker')
      .select('*')
      .order('Start', { ascending: true })
    if (error) {
      console.error('Error fetching sessions:', error.message);
      return [];
    }

    return data.map(session => ({
      id: session.id,
      start: session.Start,
      end: session.End,
      duration: session.Duration_minutes,
      task: session.Task,
      Date: session.Date,
      createdFromApp: false,                  //data fetched from supabase (initial import) - protected
    }));
  };

  //load session into state
  const loadSessions = async () => {
    try {
      const sessionsData = await fetchSessionsFromSupabase();
      setSessions(sessionsData);
      console.log('Sessions loaded from supabase:', sessionsData.length);
    } catch (error) {
      console.log('Error loading sessions:', error)
    }
  };

  //Effect to load sessions initially
  useEffect(() => {
    loadSessions();
  }, [])

  ///////////////////////////////////////////////////////////////////////////////////////////

  //function to reset app 
  const resetAppData = async () => {
    try {
      const { error } = await supabase.from('sessions').delete();
      if (error) {
        console.error('Error clearing supabase data:', error);
        return;
      }

      //reset state
      setSessions([]);
      setTask('');
      setIsStudying(false);
      setStartTime(null);

      console.log('supabase data reset complete...')
    } catch (error) {
      console.log("Error resetting app data:", error)
    }
  }

  //confirm reset
  const confirmReset = () => {
    Alert.alert(
      "Confirm Reset",
      "Are you sure you want to reset the App? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel"},
        { text: "Yes, Reset", onPress: resetAppData}
      ]
    );
  };

  //////////////////////////////////////////////////////////////////////////////////////////////////////

  //starting and ending study sessions
  const startSession = () => {
    if(!task) {
      Alert.alert("Task required","Please enter a task!");
      return;
    }

    setIsStudying(true);                                               // set the user as studying
    setStartTime(moment());                                            // record the start time wiht moment to handle time zone properly
  
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
    const endTime = moment();                                          // record the end time
    const duration = endTime.diff(startTime, 'minutes');

    const newSession = {
      Start: startTime.format('HH:mm:ss'), 
      End: endTime.format('HH:mm:ss'),
      Duration_minutes: duration,
      Task: task,
      Date: moment().format('YYYY-MM-DD'),
      createdFromApp: true,                                             //manually added session
    };

    try {
      //insert new session into supabase
      const { data, error } = await supabase.from('tracker').insert([newSession]);

      if (error) {
        console.log('Error inserting session:', error.message);
        Alert.alert('Error', 'Failed to save session. Try again.');
      } else {
        console.log('Session saved to supabase:', data);
        setIsStudying(false);                                           //set user as not studying anymore
        setTask('');                                                    //reset task input
      }
    } catch (error) {
      console.log('Error saving session:', error.message);
      Alert.alert("Error", "Failed to save session. Try again.");
    }
  };

   //Handle calendar date selection
   const onDayPress = (day) => {
    setSelectedDate(day.dateString)
  }

  //calcualte study duration for the selected day
  const calculateStudyDurationForDay = (date) => {
      const filteredSessions = sessions.filter((session) => session.Date === date)
      const totalDuration = filteredSessions.reduce((total, session) => total + (session.duration || 0), 0)
      return Number(totalDuration).toFixed(2);
  };

   //function to delete a session
   const deleteSession = async (sessionId) => {
    // find the session to delete by session id
    const sessionToDelete = sessions.find(session => session.id === sessionId)

    //prevent deletion if session was created from supabase
    if (sessionToDelete.createdFromApp === false) {
      Alert.alert("Action Denied", "You cannot delete sessions fetched from supabase.");
      return;
    }

    try {
      //delete session locally from app's state
      const updatedSessions = sessions.filter(session => session.id !== sessionId);
      setSessions(updatedSessions);                                                     //update app's state

      //delete session from supabase
      const { error } = await supabase.from('tracker').delete().eq('id',sessionToDelete.id);

      if (error) {
        console.log('Error deleting session:', error.message);
        Alert.alert("Error", "Failed to delete sesion. Try again.");
      } else {
        console.log('Session deleted from Supabase');
      }
    } catch (error) {
      console.log('Error deleting session:', error.message);
      Alert.alert("Error", "Failed to delete session. Try again.");
    }
  };

  //function to calculate study duration & group by date
  const calculateStudyByDate = (sessions) => {
    const dateMap = {};
    sessions.forEach((session) => {
      const date = session.Date; 
      dateMap[date] = (dateMap[date] || 0) + session.duration;
    });
    return dateMap;
  };
  const studyByDate = calculateStudyByDate(sessions)

  //function to format the time to show AM/PM
  const formatStartTime = (start) => {
    if (!start) return "N/A";
    const startDate = moment(start, "HH:mm:ss");
    return startDate.isValid() ? startDate.format('hh:mm A') : "Invalid Time";
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

      {/*Reset Button*/}
      <TouchableOpacity style={styles.resetBtn} onPress={confirmReset}>
        <Text style={styles.resetBtnTxt}>Reset</Text>
      </TouchableOpacity>

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
          justifyContent: 'center',
          height: 40,

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
        style={{
          height: 320,
          backgroundColor: 'transparent',
          marginBottom: 5,
          overflow: 'hidden',
          width: screenWidth - 20,
        }}
        theme={{
          textDayFontSize: 12,
          monthTextColor: 'white',
          textMonthFontSize:20,
          textMonthFontWeight: 'bold',
          textSectionTitleColor: 'yellow',
        }}
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
              container: { 
                backgroundColor,
                padding: 0,
                margin: 0,
              },
              text: {
                color: hoursStudied > 0 ? 'white' : 'black',
                fontWeight: 'bold',
                margin: 0,
                padding: 0,
              }
            },
          };
          return acc;
        }, {})}
        markingType={'custom'}
      />

      <FlatList 
        data={sessions.filter((session) => !selectedDate || session.Date === selectedDate)}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={{
          padding: 10,
          width: '100%',
          alignItems: 'center',
        }}
        renderItem={({item, index}) => {
          const formattedStartTime = formatStartTime(item.start);
          const formattedEndTime = formatStartTime(item.end)
          return (
            <View style={[styles.sessionItem, { width: '98%' }]}> 
            <Text>Task: {item.task || "No Task Available"}</Text>
            <Text>Duration: {item.duration} minutes</Text>
            <Text>Date: {item.Date}</Text>
            <Text>Start Time: {formattedStartTime}</Text>
            <Text>End Time: {formattedEndTime}</Text>
            <TouchableOpacity onPress={() => deleteSession(item.id)}>
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
    padding: 10,
    backgroundColor: '#001F3F',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    paddingHorizontal: 10,
    color: 'white'
  },
  totalDuration: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'yellow',
    textAlign: 'center',
  },
  highlightedValue: {
    color: 'fuchsia', 
    fontWeight: 'bold',
  },
  header: {
    fontSize: 30, 
    paddingTop: 10,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center'
  },
  sessionItem: {
    marginVertical: 5,
    padding: 8, 
    backgroundColor: '#fde2e4',
    borderRadius: 8,
  },
  deleteButton: {
    color: 'red',
    marginTop: 5,
  },
  legendContainer: {
    marginVertical: 12,
    direction: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 5,
    backgroundColor: '#2C3E50',
    borderRadius: 8,
    width: '90%',
    alignSelf: 'center',
  }, 
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBox: {
    width: 18,
    height: 18,
    marginRight: 10,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: 'white',
  },
  resetBtn: {
    backgroundColor: 'red',
    width: 40,
    padding: 3,
    marginBottom: 5,
    borderRadius: 15,
  },
  resetBtnTxt: {
    textAlign: 'center',
    color: 'white',
    fontSize: 12,
  }
});

export default App;