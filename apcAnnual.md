Moy. géné. de la classe, Taux de réussite, Moyenne du premier[min], Moyenne du dernier[max], are calculated based on annual average of all students of the current class.

APC mark are also loaded from table stud_comp_mark, as we did for term average 
computeClassifiedAnnual(student, classe, year) that we previously defined for non APC annual RC is also used for APC annual RC


//--------> Annual averge of a student for the current schoolyear is obtained using the following algoritm
  if basic_school_config.val1 = 1; compute using simpleComputeAnnualAverageAPC() defined below
  else compute using complexComputeAnnualAverageAPC() defined below
   
  ///--->CALCUL SIMPLE DE LA MOYENNE (TRIM1+TRIM2+TRIM3)/3 
  ///simpleComputeAnnualAverageAPC is similar to simpleComputeAnnualAverage, 
  ///but students mark beeing read from stud_comp_mark table
   simpleComputeAnnualAverageAPC(student) {
    //student here is the current student
    //student.avgTerm1, student.avgTerm2 and student.avgTerm3 are student averages respectively in term 1, term 2 and term 3
	//student.avgTerm1.isTermAvgEmpty, student.avgTerm2.isTermAvgEmpty, student.avgTerm3.isTermAvgEmpty.
	//student.avgTermi.isTermAvgEmpty=true(i in{1,2,3}) means for us that student has no mark int term i (i in{1, 2, 3}) 
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
  complexComputeAnnualAverageAPC(student) {
     applied computation based on example shown on for the current student @/assets/SAMPLE_RC/simple_computation_apc.png
     totalCoef = sum of all coefficients in column coef as shown on image @/assets/SAMPLE_RC/simple_computation_apc.png
     totalMxCoef = sum of all average in a subject times coef in column M.xC as shown on image @/assets/SAMPLE_RC/simple_computation_apc.png
     if(totalCoef >0)
        return totalMxCoef/totalCoef;
    else
        retutn 0;
  }
   

   
//--------> Here is how to compute average of student in a suject for the current school year
//Used only for APC
computeAnnulAverageOfStudentInSubjectAPC(student, subject, year){
    //avgTermi i in{1, 2, 3} is average of the current student in termi {1, 2, 3}.  
    //This is similar with what was done in APC term RC. Here for annual we would like to know for
    //each term is student had marks or, not. 
    //avgTermi i in{1, 2, 3} is null if student has no mark for that term
    Double avgTerm1 = getStudCompTermAvg(year, subject.subject_id, student.stud_id, 1);
    Double avgTerm2 = getStudCompTermAvg(year, subject.subject_id, student.stud_id, 2);
    Double avgTerm3 = getStudCompTermAvg(year, subject.subject_id, student.stud_id, 3);
    double avg = 0;
      if (avgTerm1 == null && avgTerm2 == null && avgTerm3 == null) {
       
      } else {
        //AT LEAST a Term average in that subject is not empty
        //---- CAS 2 NULLS
        if (avgTerm2 == null && avgTerm3 == null) {
          avg = avgTerm1;
        } else if (avgTerm1 == null && avgTerm3 == null) {
          avg = avgTerm2;
        } else if (avgTerm1 == null && avgTerm2 == null) {
          avg = avgTerm3;
        }
        //CAS 1 NULL
        else if (avgTerm3 == null) {
          avg = (avgTerm1 + avgTerm2) / 2;
        } else if (avgTerm2 == null) {
          avg = (avgTerm1 + avgTerm3) / 2;
        } else if (avgTerm1 == null) {
          avg = (avgTerm2 + avgTerm3) / 2;
        }
        //CAS TOUS NON NULLS
        else {
          avg = (avgTerm1 + avgTerm2 + avgTerm3) / 3;
        } 
      }  
      return avg;
   
}     

//getStudentSubject called in computeAnnulAverageOfStudentInSubjectAPC is defined as follows
Double getStudCompTermAvg(year, subject_id, stud_id, term){
	find marks in stud_cmp_mark table for subject_id, stud_id, year and term. //term is integer in{1,2,3}
	if marks records not found
	   return null;
	
	if(marks != null){ //marks are found 
      int count = 0;
      total = 0;
      for(marks: mk){
        if(mk.isEmpty == 0){
            count++;
            total += double.parse(mk.mark);
        }
      }
      if(count>0){
        return total/count;
      }
    }
	return null;
}

 
For Appreciation uses the same algorithm that was used for term non APC RC
String getCompComment(double avg) {
  if (avg < 10) {
    return "CNA";
  } else if (avg >= 10 && avg < 12) {
    return "CMA";
  } else if (avg >= 12 && avg < 14) {
    return "CA";
  } else if (avg >= 14 && avg < 16) {
    return "CBA";
  } else if (avg >= 16 && avg < 20) {
    return "CTBA";
  } else {
    print("utily.dart.getCompComment(): Average out of range");
    return "";
  }
}

to have cote we use same algorithm as for APC term RC
String getCote(double avg) {
  if (avg < 10) {
    return "D";
  } else if (avg >= 10 && avg < 12) {
    return "C";
  } else if (avg >= 12 && avg < 14) {
    return "C+";
  } else if (avg >= 14 && avg < 15) {
    return "B";
  } else if (avg >= 15 && avg < 16) {
    return "B+";
  } else if (avg >= 16 && avg < 18) {
    return "A";
  } else if (avg >= 18 && avg <= 20) {
    return "A+";
  } else {
    print("utily.dart.getCote(): Average out of range");
    return "";
  }
}
 
Decision bloc is build similarly as we did for non APC RC
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
	