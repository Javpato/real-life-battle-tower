import './exercise-pose-art.css';
/** Original pixel coach art. Teaching illustrations do not run detection or credit movement. */
export default function ExercisePoseArt({exerciseId,title}:{exerciseId:string;title:string}){
 return <figure className="tower-exercise-pose"><div className="tower-pose-labels" aria-hidden="true"><span>01 · START</span><span>02 · MOVE</span></div><img src={`${import.meta.env.BASE_URL}assets/tower/guide-${exerciseId}.png`} width={280} height={140} alt={`${title}: starting position on the left and movement on the right`} draggable={false}/></figure>;
}
