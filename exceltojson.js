const XLSX = require('xlsx');
const fs = require('fs');
const dayjs = require('dayjs')

//path to my excel file
const filePath = './Study tracker - JS.xlsx'

//read excel file
const workbook = XLSX.readFile(filePath);

//get the first sheet name 
const sheetName = workbook.SheetNames[0];

//get worksheet 
const worksheet = workbook.Sheets[sheetName];

//convert to json
const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1})

//format json data for better readability 
const formattedData = jsonData.slice(1).map((row) => {
    const excelDate = row[1];                                                                   //date column
    const task = row[2] || '';                                                                  //task column
    const startTimeValue = row[3];
    const endTimeValue = row[4];
    const durationInMinutesInExcel = row[6];

    const date = excelDate                                                                      // Convert Excel date ---> JS epoch time
        ? dayjs(new Date((excelDate - 25569) * 86400 * 1000)).format('YYYY/MM/DD')
        : "No Date";

    const formatTime = (timeValue) => {
        if (typeof timeValue === 'number') {
            const hours = Math.floor(timeValue * 24);
            const minutes = Math.round((timeValue * 24 * 60) % 60);
            return dayjs().hour(hours).minute(minutes);
        } else if (typeof timeValue === 'string') {
            return dayjs(timeValue, 'hh:mm A');
        }
        return dayjs();
    }

    const startTime = startTimeValue ? formatTime(startTimeValue) : dayjs();          // Convert Start time
    const endTime = endTimeValue ? formatTime(endTimeValue) : dayjs();                   // Convert End time (12 hour + AM/PM)
    
    return {
        Date: date,
        Task: task || "No Task",
        Start: startTime.format('hh:mm A'),
        End: endTime.format('hh:mm A'),
        Duration: durationInMinutesInExcel.toString()
    };
});

//write json data to a file
fs.writeFileSync('tracker.json', JSON.stringify(formattedData, null, 2));

console.log('Data from excel has been converted to JSON and saved to tracker.json')