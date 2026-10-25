import { PEOPLE, QUESTIONS } from "@/config/questions";
import { Questionnaire } from "@/components/Questionnaire";

export default function Home() {
  return <Questionnaire questions={QUESTIONS} defaultPeople={PEOPLE} />;
}
