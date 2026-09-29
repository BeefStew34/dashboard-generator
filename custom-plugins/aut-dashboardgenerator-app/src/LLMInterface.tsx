import { currentSettings as settings } from 'Settings';  
import axios from 'axios';
import { QueryResult } from 'Generator';  


const AskOpenAI = async (prompt: string) => {
    const key : string = settings["OpenAIKey"];
    const model : string = settings["Model"];
    console.log("Ask Open AI Called");
    const post_data = {
        "input": prompt,
        "model": model
    };
    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
    };

    const { data, status } = await axios.post<QueryResult>(
      'https://api.openai.com/v1/responses',
      post_data,
      { headers }
    );

    console.log(data);  

    if (status !== 200) return null;

    return data;
};

export const GenerateDashboard = async () => {
  switch(settings["SelectedAI"]){
    case "openai":
      AskOpenAI("Hello, how are you?");
      break;
    // Add cases for other AI providers
  }
};