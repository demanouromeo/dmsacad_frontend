Moy. géné. de la classe, Taux de réussite, Écart type (standard deviation), Moyenne du premier, Moyenne du dernier are calculated based on annual average of all students of the current class
Non APC mark are also loaded from table student_subject, as we did for term average
//--------> This is how to find if student is classeified for the current school year
  computeClassifiedAnnual(student, classe, year) {
    //classifiedParam is loaded from table classifiedparam for the current school year
	boolean isMannullalyClassified = read student_classe.isMannullalyClassified for the student, and current classe for the current year
	if(isMannullalyClassified == 1){
		.isClassifiedAnnual = true;
		return true;
	}else if(){
		student.isClassifiedAnnual = false;
		return false;
	}
	//student_classe.isMannullalyClassified = 2. So it has to calculated
	isClassifiedAnnual = false;
    if (classifiedParam == null) {
      isClassifiedAnnual = true; //Tous les eleves seront classe dans ce cas
    } else {      
        boolean val = classifiedParam.classified;         
        if (!val) { //in this case in table classifiedparam, classifiedParam.classified=0 for the current school year. In this case ANY student for the current school year is classified
          isClassifiedAnnual = true;
        } else {           
          int nbMatieres = subjectsOfSelectedClasse.length;
          if (nbMatieres == 0) {
            isClassifiedAnnual = false; //La classe n'a encore aucune matiere
          } else {                         
              isClassifiedAnnual = true if student is classified at least in two terms (there are 3 terms in each school year).
									false otherwise;            
          }
        }
       
    }
	student.isClassifiedAnnual = true;
	return isClassifiedAnnual;
  }
  computeClassifiedAnnual algorithm works both for APC and Non APC classes


//--------> Annual averge of a student for the current schoolyear is obtained using the following algoritm
  if basic_school_config.val1 = 1; compute using simpleComputeAnnualAverage() defined below
  else compute using complexComputeAnnualAverage() defined below
   
  ///--->CALCUL SIMPLE DE LA MOYENNE (TRIM1+TRIM2+TRIM3)/3
  simpleComputeAnnualAverage(student) {
    //student here is the current student
    //student.avgTerm1, student.avgTerm2 and student.avgTerm3 are student averages respectively in term 1, term 2 and term 3
	//student.avgTerm1.isTermAvgEmpty, student.avgTerm2.isTermAvgEmpty, student.avgTerm3.isTermAvgEmpty.
	//student.avgTermi.isTermAvgEmpty=true(i in{1,2,3}) means for us that student has no mark int term i (i in{1, 2, 3) 
    double avgAnnual = 0;
	boolean isAnnualAvgEmpty = false;
    try {
      if (student.avgTerm1.isTermAvgEmpty &&
          student.avgTerm2.isTermAvgEmpty &&
          student.avgTerm3.isTermAvgEmpty) { //Student has no mark in term1, term2 and term3
        isAnnualAvgEmpty = true;
      } else {
        //CAS UN NULL
        if (student.avgTerm3.isTermAvgEmpty) {
          avgAnnual = (student.avgTerm1.avgTerm + student.avgTerm2.avgTerm) / 2;
        } else if (student.avgTerm2.isTermAvgEmpty) {
          avgAnnual = (student.avgTerm1.avgTerm + student.avgTerm3.avgTerm) / 2;
        } else if (student.avgTerm1.isTermAvgEmpty) {
          avgAnnual = (student.avgTerm2.avgTerm + student.avgTerm3.avgTerm) / 2;
        }
		
        //CAS 2 NULLS
        else if (student.avgTerm2.isTermAvgEmpty && student.avgTerm3.isTermAvgEmpty) {
          avgAnnual = student.avgTerm1.avgTerm;
        } else if (student.avgTerm1.isTermAvgEmpty && student.avgTerm3.isTermAvgEmpty) {
          avgAnnual = student.avgTerm2.avgTerm;
        } else if (student.avgTerm1.isTermAvgEmpty && student.avgTerm2.isTermAvgEmpty) {
          avgAnnual = student.avgTerm3.avgTerm;
        }
		
        //CAS TOUS NON NULLS
        else {
          avgAnnual =
              (student.avgTerm1.avgTerm + student.avgTerm2.avgTerm + student.avgTerm3.avgTerm) /
                  3;           
        }
        avgAnnual = double.parse(avgAnnual.toStringAsFixed(2));
        isAnnualAvgEmpty = false;         
      }
    } catch (e) { 
    }
	student.avgAnnual = avgAnnual;
	return avgAnnual;
  }
  
  ///CALCUL COMPLEXE DE LA MOYENNE
  computeAnnualAverage(student, subjectOfCurrentClass, year) {
    //studentSujects here are non APC marks of students of the current classe in the current school year (obtained from student_subject table)
    double totalCoefAnnual = 0;
    double totalMxCAnnual = 0;
    double avgAnnual = 0;
	boolean isAnnualAvgEmpty = false;	
	for(subjectOfCurrentClass: subject){
	    //on table student_subject, When student_subject.isEmpty for a given mark = 0, the mark is considered to be empty.
		if(student has no mark in that subject for the current school year){
			skip the subject;
		}else{
			try{
				double avg = Double.parse(computeAnnulAverageOfStudentInSubject(student, subject, year));
				double coef = coef of subject in the current classe;//find it in table, subject_classe,subject_classe.coef where subject_id, classe_id, sy_id and section_id matches with current settings
				totalCoefAnnual += coef;
				totalMxCAnnual += avg * coef;
			}catch(e){}
			count++;
		}
	}
	   
    if (totalCoefAnnual <= 0) {
        isAnnualAvgEmpty = true; //L'élève n'a pas composé 
    } else {
        //totalCoefAnnual > 0
        avgAnnual = totalMxCAnnual / totalCoefAnnual;
        isAnnualAvgEmpty = false;
    }
	student.avgAnnual = avgAnnual;
	student.isAnnualAvgEmpty = isAnnualAvgEmpty;  
	return avgAnnual;     
  }

   
//--------> Here is how to compute average of student in a suject for the current school year
//Used only for Non APC
computeAnnulAverageOfStudentInSubject(student, subject, year){
   
        StudentSubject mkEval1 = getStudentSubject(year, subject_id, stud_id, 1);
        StudentSubject mkExam1 = getStudentSubject(year, subject_id, stud_id, 2);
        StudentSubject mkEval2 = getStudentSubject(year, subject_id, stud_id, 3);
        StudentSubject mkExam2 = getStudentSubject(year, subject_id, stud_id, 4);
        StudentSubject mkEval3 = getStudentSubject(year, subject_id, stud_id, 5);
        StudentSubject mkExam3 = getStudentSubject(year, subject_id, stud_id, 6);

        double moyAnOfCurrentSubject = 0;
		String moy = "";
        if (mkEval1 == null &&
            mkExam1 == null &&
            mkEval2 == null &&
            mkExam2 == null &&
            mkEval3 == null &&
            mkExam3 == null) { 
		   moyAnOfCurrentSubject = 0;
        } else {
          //----------------------------------------------------------------------
          //----> Cas 5 nulls
          //eval1
          if (mkExam1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
              moyAnOfCurrentSubject = mkEval1.mark;               
          }
          //eval2
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkExam2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = mkEval2.mark;             
          }
          //eval3
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = mkEval3.mark;             
          }
          //exam1
          else if (mkEval1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = mkExam1.mark;             
          }
          //exam2
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkEval2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = mkExam2.mark;             
          }
          //exam3
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkEval3 == null) {
			  moyAnOfCurrentSubject = mkExam3.mark;             
          }
          //----------------------------------------------------------------------
          //----> Cas 4 nulls
          //eval1+eval2
          else if (mkExam1 == null &&
              mkExam2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval1!.mark! + mkEval2!.mark!) / 2;             
          }
          //eval1+eval3
          else if (mkExam1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval1!.mark! + mkEval3!.mark!) / 2;             
          }
          //eval1+exam1
          else if (mkEval2 == null &&
              mkExam2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval1!.mark! + mkExam1!.mark!) / 2;             
          }
          //eval1+exam2
          else if (mkExam1 == null &&
              mkEval2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval1!.mark! + mkExam2!.mark!) / 2;             
          }
          //eval1+exam3
          else if (mkExam1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkEval3 == null) {
			  moyAnOfCurrentSubject = (mkEval1!.mark! + mkExam3!.mark!) / 2;             
          }
          //eval2+eval3
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkExam2 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval2!.mark! + mkEval3!.mark!) / 2;            
          }
          //eval2+exam1
          else if (mkEval1 == null &&
              mkExam2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval2!.mark! + mkExam1!.mark!) / 2;             
          }
          //eval2+exam2
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval2!.mark! + mkExam2!.mark!) / 2;             
          }
          //eval2+exam3
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkExam2 == null &&
              mkEval3 == null) {
			  moyAnOfCurrentSubject = (mkEval2!.mark! + mkExam3!.mark!) / 2;            
          }
          //eval3+exam1
          else if (mkEval1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval3!.mark! + mkExam1!.mark!) / 2;             
          }
          //eval3+exam2
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkEval2 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkEval3!.mark! + mkExam2!.mark!) / 2;             
          }
          //eval3+exam3
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkEval2 == null &&
              mkExam2 == null) {
			  moyAnOfCurrentSubject = (mkEval3!.mark! + mkExam3!.mark!) / 2;             
          }
          //exam1+exam2
          else if (mkEval1 == null &&
              mkEval2 == null &&
              mkEval3 == null &&
              mkExam3 == null) {
			  moyAnOfCurrentSubject = (mkExam1!.mark! + mkExam2!.mark!) / 2;             
          }
          //exam1+exam3
          else if (mkEval1 == null &&
              mkEval2 == null &&
              mkExam2 == null &&
              mkEval3 == null) {
			  moyAnOfCurrentSubject = (mkExam1!.mark! + mkExam3!.mark!) / 2;             
          }
          //exam2+exam3
          else if (mkEval1 == null &&
              mkExam1 == null &&
              mkEval2 == null &&
              mkEval3 == null) {
			  moyAnOfCurrentSubject = (mkExam2!.mark! + mkExam3!.mark!) / 2;             
          }
          //----------------------------------------------------------------------
          //----> Cas 3 nulls
          //exam1 + exam2 + exam3
          else if (mkEval1 == null && mkEval2 == null && mkEval3 == null) {
			moyAnOfCurrentSubject =
                  (mkExam1!.mark! + mkExam2!.mark! + mkExam3!.mark!) / 3;             
          }
          //eval1 + eval2 + eval3
          else if (mkExam1 == null && mkExam2 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkEval2!.mark! + mkEval3!.mark!) / 3;             
          }
          //eval1 + eval2 + exam1
          else if (mkExam2 == null && mkEval3 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkEval2!.mark! + mkExam1!.mark!) / 3;             
          }
          //eval1 + eval2 + exam2
          else if (mkExam1 == null && mkEval3 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkEval2!.mark! + mkExam2!.mark!) / 3;             
          }
          //eval1 + eval2 + exam3
          else if (mkExam1 == null && mkExam2 == null && mkEval3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkEval2!.mark! + mkExam3!.mark!) / 3;             
          }
          //eval1 + eval3 + exam1
          else if (mkEval2 == null && mkExam2 == null && mkExam3 == null) {
		  moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkEval3!.mark! + mkExam1!.mark!) / 3;             
          }
          //eval1 + eval3 + exam2
          else if (mkExam1 == null && mkEval2 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkEval3!.mark! + mkExam2!.mark!) / 3;             
          }
          //eval1 + eval3 + exam3
          else if (mkExam1 == null && mkEval2 == null && mkExam2 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkEval3!.mark! + mkExam3!.mark!) / 3;
           }
          //eval1 + exam1 + exam2
          else if (mkEval2 == null && mkEval3 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkExam1!.mark! + mkExam2!.mark!) / 3;
             
          }
          //eval1 + exam1 + exam3
          else if (mkEval2 == null && mkExam2 == null && mkEval3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkExam1!.mark! + mkExam3!.mark!) / 3;             
          }
          //eval1 + exam2 + exam3
          else if (mkEval2 == null && mkExam1 == null && mkEval3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval1!.mark! + mkExam2!.mark! + mkExam3!.mark!) / 3;             
          }
          //eval2 + eval3 + exam1
          else if (mkEval1 == null && mkExam2 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval2!.mark! + mkEval3!.mark! + mkExam1!.mark!) / 3;             
          }
          //eval2 + eval3 + exam2
          else if (mkEval1 == null && mkExam1 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval2!.mark! + mkEval3!.mark! + mkExam2!.mark!) / 3;            
          }
          //eval2 + eval3 + exam3
          else if (mkEval1 == null && mkExam1 == null && mkExam2 == null) {
			moyAnOfCurrentSubject =
                  (mkEval2!.mark! + mkEval3!.mark! + mkExam3!.mark!) / 3;
          }
          //eval2 + exam1 + exam2
          else if (mkEval1 == null && mkEval3 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval2!.mark! + mkExam1!.mark! + mkExam2!.mark!) / 3;             
          }
          //eval2 + exam1 + exam3
          else if (mkEval1 == null && mkExam2 == null && mkEval3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval2!.mark! + mkExam1!.mark! + mkExam3!.mark!) / 3;             
          }
          //eval2 + exam2 + exam3
          else if (mkEval1 == null && mkExam1 == null && mkEval3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval2!.mark! + mkExam2!.mark! + mkExam3!.mark!) / 3;             
          }
          //eval3 + exam1 + exam2
          else if (mkEval1 == null && mkEval2 == null && mkExam3 == null) {
			moyAnOfCurrentSubject =
                  (mkEval3!.mark! + mkExam1!.mark! + mkExam2!.mark!) / 3;             
          }
          //eval3 + exam1 + exam3
          else if (mkEval1 == null && mkEval2 == null && mkExam2 == null) {
			moyAnOfCurrentSubject =
                  (mkEval3!.mark! + mkExam1!.mark! + mkExam3!.mark!) / 3;             
          }
          //eval3 + exam2 + exam3
          else if (mkEval1 == null && mkExam1 == null && mkEval2 == null) {
			moyAnOfCurrentSubject =
                  (mkEval3!.mark! + mkExam2!.mark! + mkExam3!.mark!) / 3;             
          }
          //----------------------------------------------------------------------
          //----> Cas 2 nulls
          //eval1 + eval2 + eval3 + exam1
          else if (mkExam2 == null && mkExam3 == null) {            
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam1!.mark!) /
                  4;             
          }
          //eval1 + eval2 + eval3 + exam2
          else if (mkExam1 == null && mkExam3 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam2!.mark!) /
                  4;
            }
          //eval1 + eval2 + eval3 + exam3
          else if (mkExam1 == null && mkExam2 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam3!.mark!) /
                  4;
          }
          //eval1 + eval2 + exam1 + exam2
          else if (mkEval3 == null && mkExam3 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkExam1!.mark! +
                      mkExam2!.mark!) /
                  4;
            } 
          }
          //eval1 + eval2 + exam1 + exam3
          else if (mkEval3 == null && mkExam2 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkExam1!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval1 + eval2 + exam2 + exam3
          else if (mkEval3 == null && mkExam1 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkExam2!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval1 + eval3 + exam1 + exam2
          else if (mkEval2 == null && mkExam3 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval3!.mark! +
                      mkExam1!.mark! +
                      mkExam2!.mark!) /
                  4; 
          }
          //eval1 + eval3 + exam1 + exam3
          else if (mkEval2 == null && mkExam2 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval3!.mark! +
                      mkExam1!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval1 + eval3 + exam2 + exam3
          else if (mkEval2 == null && mkExam1 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval3!.mark! +
                      mkExam2!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval1 + exam1 + exam2 + exam3
          else if (mkEval2 == null && mkEval3 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkExam1!.mark! +
                      mkExam2!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval2 + eval3 + exam1 + exam2
          else if (mkEval1 == null && mkExam3 == null) { 
              moyAnOfCurrentSubject = (mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam1!.mark! +
                      mkExam2!.mark!) /
                  4; 
          }
          //eval2 + eval3 + exam1 + exam3
          else if (mkEval1 == null && mkExam2 == null) { 
              moyAnOfCurrentSubject = (mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam1!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval2 + eval3 + exam2 + exam3
          else if (mkEval1 == null && mkExam1 == null) { 
              moyAnOfCurrentSubject = (mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam2!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval2 + exam1 + exam2 + exam3
          else if (mkEval1 == null && mkEval3 == null) { 
              moyAnOfCurrentSubject = (mkEval2!.mark! +
                      mkExam1!.mark! +
                      mkExam2!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //eval3 + exam1 + exam2 + exam3
          else if (mkEval1 == null && mkEval2 == null) { 
              moyAnOfCurrentSubject = (mkEval3!.mark! +
                      mkExam1!.mark! +
                      mkExam2!.mark! +
                      mkExam3!.mark!) /
                  4; 
          }
          //----------------------------------------------------------------------
          //----> Cas 1 nulls
          //eval1 + eval2 + eval3 + exam1 + exam2
          else if (mkExam3 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam1!.mark! +
                      mkExam2!.mark!) /
                  5; 
          }
          //eval1 + eval2 + eval3 + exam1 + exam3
          else if (mkExam2 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam1!.mark! +
                      mkExam3.mark!) /
                  5; 
          }
          //eval1 + eval2 + eval3 + exam2 + exam3
          else if (mkExam1 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkEval3!.mark! +
                      mkExam2.mark! +
                      mkExam3.mark!) /
                  5; 
          }
          //eval1 + eval2 + exam1 + exam2 + exam3
          else if (mkEval3 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval2!.mark! +
                      mkExam1.mark! +
                      mkExam2.mark! +
                      mkExam3.mark!) /
                  5; 
          }
          //eval1 + eval3 + exam1 + exam2 + exam3
          else if (mkEval2 == null) { 
              moyAnOfCurrentSubject = (mkEval1!.mark! +
                      mkEval3.mark! +
                      mkExam1.mark! +
                      mkExam2.mark! +
                      mkExam3.mark!) /
                  5; 
          }
          //eval2 + eval3 + exam1 + exam2 + exam3
          else if (mkEval1 == null) { 
              moyAnOfCurrentSubject = (mkEval2.mark! +
                      mkEval3.mark! +
                      mkExam1.mark! +
                      mkExam2.mark! +
                      mkExam3.mark!) /
                  5; 
          }
          //----------------------------------------------------------------------
          //----> Cas tous non null
          else { 
              moyAnOfCurrentSubject = (mkEval1.mark! +
                      mkEval2.mark! +
                      mkEval3.mark! +
                      mkExam1.mark! +
                      mkExam2.mark! +
                      mkExam3.mark!) /
                  6; 
          }           
        } //END MAIN IF
		moy = moyAnOfCurrentSubject.toString; //Moy will be displayed in M./20 for each subject; so that if student has no mark in that subject in the current year, '' is used as M./20 value for that subject
        return moyAnOfCurrentSubject;
}

//getStudentSubject called in computeAnnulAverageOfStudentInSubject is defined as follows
StudentSuject getStudentSubject(year, subject_id, stud_id, dbSequence){
	find mark in student_subject table for subject_id, stud_id, year and dbSequence. //dbSequence is integer in{1,2,3,4,5,6}
	if mark record not found
	   return null;
	
	if mark found but mark.isEmpty = 1 (when student_subject.isEmpty = 1; We consider there is no mark)
	   return null
	else
		return mark;
}

for column Rang, the student rang in for each subject is determined similarly as we did for non APC term report card. This time using but student anual averages in each subject

For Appreciation use the same algorithm that was used for term non APC RC
 
 
 
 
//--> Here is how to get DÉCISION DU CONSEIL DE FIN D'ANNÉE promuEnText(Like PROMU EN: ___________)
read  basic_school_config.val2 for the current year
String getPromuEnText(student, year){
promuEnText = "";
if(val2 == 0){
   promuEnText= "PROMU EN: ___________" or "PROMUE EN: ___________" if student sexe is "F";
}else{
	promuen_classe_id = find student_classe.promuEn from student_classe for the current student (stud_id), year and classe
	if(promuen_classe_id is null or not found){
		promuEnText = "PROMU EN: ___________" or "PROMUE EN: ___________" if student sexe is "F";
	}else{
	    promuEnClass = name of classe which classe_id = promuen_classe_id
		promuEnText = "PROMU EN "+promuEnClass;
	}
}
return promuEnText;
}

//--> Here is how to find out if a student is dismissed or not
boolean computeDismiss(student, classe, year){
    isMannullalyDismissed = read isMannullalyDismissed from student_classe for the current student, classe and year    
	if(isMannullalyDismissed == 1){
		//The student is dismissed. No need to find any other aspect like average. This means user decided to dissmiss the student
		return true;
	}else (isMannullalyDismissed == 0){
		//Student is not dismissed; even if he has low average and high absence record. in this case user decided manually that student won't be dismissed
		return false;
	}
	//isMannullalyDismissed == 2. Here we calculated based on annualAvg, total abscences and total nomber of exclusion days       
    //L'eleve peut être exclu ou ne pas l'être
	//on Place le code d'exclusion s'il est = 0
		int absUnjustTotal = student.absjustT1 + student.absjustT2 + student.absjustT3;
	//student.absjustTi (i in {1,2,3}) represents the number of absences of the student in termi (i in {1,2,3}) of the current school year [found in discipline.absunjust]
  
	int totalExclusion = student.nbExclusionT1 + student.nbExclusionT2 + student.nbExclusionT3;
	//where student.nbExclusionTi (i in {1,2,3}) represent number of days of exclu(nombre de jours d'exclusion) found in discipline.nb_jour_exclusion
	  
	  totalAbsTh = read totalAbsTh from classe_year for the current class (class_id) and year (sy_id)
	  avgDismissalTh = read avgDismissalTh from classe_year for the current class (class_id) and year (sy_id)
	  repeatUb = read repeatUb from classe_year for the current class (class_id) and year (sy_id)
	  repeating = read repeating from student_classe for the current student, class (class_id) and year (sy_id)
	  solvable1 = read solvable1 from student_classe for the current student, class (class_id) and year (sy_id)
      if (absUnjustTotal > totalAbsTh ||
          totalExclusion > totalAbsTh ||
          avgAnnual < avgDismissalTh ||
          (avgAnnual < repeatUb && repeating==1)) {		   
        return true;
        //on Place le code d'exclusion s'il est = 0
        if (codeExclusion == 0) {
          if (absUnjustTotal > totalAbsTh ||
              totalExclusion > totalAbsTh) { 
			set student_classe.codeExclusion for the current student, year and classe is set to 2 (codeExclusion = 2 means student is dismissed for Conduite)
          } else if (avgAnnual < avgDismissalTh) { 
			set student_classe.codeExclusion for the current student, year and classe is set to 3 (codeExclusion = 3 means student is dismissed for Travail)
          } else if (avgAnnual < repeatUb && repeating==1) {    
			set student_classe.codeExclusion for the current student, year and classe is set to 4 (codeExclusion = 4 means student is dismissed for Ne peut trippler (Alredy a repeater))
          } else if (solvable1==0) {//student didn't pay school fees    
			set student_classe.codeExclusion for the current student, year and classe is set to 6 (codeExclusion = 6 means student is dismissed for Insolvable (student didn't pay school fees ))
          }
        }
      } else {
        mustDismiss = 0;
        student_classe.codeExclusion for the current student, year and classe is set to 0
      }
 }
 
 
//----> Here is how to find out if a student repeats or not
computeRepeat(student, classe, year){
	mustRepeat = read mustRepeat from student_classe for the current student, classe and year  
	if(mustRepeat == 1){
		return true;
	}else if(mustRepeat == 0){
		return false;
	}
	//mustRepeat == 2
	repeatUb = read repeatUb from classe_year for the current class (class_id) and year (sy_id)
	repeating = read repeating from student_classe for the current student, class (class_id) and year (sy_id)
	if (studend.avgAnnual < repeatUb && repeating == 0) {
        if( computeDismiss(student, classe, year)) //If student is dissmissed?
            return false;//ON NE PEUT REDOUBLER ET ETRE EXCLU AU MEME MOMEN
	    else
			return true;
    } else {
		return false;
    }
}


//----> How to build decision bloc for each student on Annual Report Card for the current school year
    //basicSchoolConfig is loaded from table basic_school_config for the current school year
	isTechnique = basicSchoolConfig.type.contains("TECHNIQUE") ||
        basicSchoolConfig.type.contains("CETIC") ||
        basicSchoolConfig.type.contains("GTHS") ||
        basicSchoolConfig.type.contains("GTC") ||
        basicSchoolConfig.type.contains("TECHNICAL");
    int totalJust = student.absjustT1 + student.absjustT2 + student.absjustT3;
	//student.absjustTi (i in {1,2,3}) represents the number of absences of the student in termi (i in {1,2,3}) of the current school year [found in discipline.absunjust]
  
	int totalExclusion = student.nbExclusionT1 + student.nbExclusionT2 + student.nbExclusionT3;
	//where student.nbExclusionTi (i in {1,2,3}) represent number of days of exclu(nombre de jours d'exclusion) found in discipline.nb_jour_exclusion
	
	boolean notClassified = !computeClassifiedAnnual(student, current_classe, current_year);	
    boolean mustDismiss = computeDismiss(student, classe, year);//true if student is dismisses	
	boolean mustRepeat = computeRepeat(student, classe, year); //true if student must repeat the next school year
	repeatUb = read repeatUb from classe_year for the current class (class_id) and year (sy_id)
    
	if (level == 6 || level == 7 || (level == 4 && isTechnique)) && mustDismiss !=1){	  
		How decision bloc should look like in this case is shown on image @/assets/SAMPLE_RC/redouble_si_echec.png	
		if display language is french
			build the decision bloc with message "Redouble si echec" 
		in case display language is english and (level == 4 && isTechnique)
			build the decision bloc with message "Repeact if should fail CAP"
		else
			build the decision bloc with message "Repeact if should fail GCE"
		
	} 
		// student is promoted = find student_classe.promuEn from student_classe for the current student (stud_id), year and classe
	boolean bool = !(level == 6 || level == 7 || (level == 4 && isTechnique)) && !mustDismiss && !mustRepeat && !notClassified &&  
                    (stud.avgAnnual >= repeatUb || promuen_classe_id != 0)
		if(bool){// student is promoted
			build the decision bloc with message getPromuEnText(student, year)
			the decision bloc may look like what is shown on image @/assets/SAMPLE_RC/promu_en_empty.png or @/assets/SAMPLE_RC/promu_en.png	
		}else {
			build the decision bloc with message "Non Classé (NC)"
			it may look like what is shown on image @/assets/SAMPLE_RC/promu_en_empty.png or @/assets/SAMPLE_RC/nc.png	
		}
	
	
	
	bool = !(level == 6 || level == 7 || (level == 4 && isTechnique)) && !mustDismiss &&
                    stud.avgAnnual <  repeatUb && !notClassified
    if(bool){
		build the decision bloc with message "Redouble"
			it may look like what is shown on image @/assets/SAMPLE_RC/promu_en_empty.png or @/assets/SAMPLE_RC/redouble.png	
	}
	
	if(mustDismiss){//L'eleves est exclu
		build the decision bloc with message "Exclu pour" or "Exclue pour" if student sexe is "F"
			it may look like what is shown on image @/assets/SAMPLE_RC/promu_en_empty.png or @/assets/SAMPLE_RC/eclu_pour.png
		Only one exclusion reason is ticket depending on the value of student_classe.codeExclusion
		if(codeExclusion == 2) tick the reason "Conuite"
		if(codeExclusion == 3) tick the reason "Travail"
		if(codeExclusion == 4) tick the reason "Ne peut trippler (Alredy a repeater)"
		if(codeExclusion == 6) tick the reason "Insolvable"
		//There are other reason, but we handle only the above 4 reasons for the moment
	}