/**
 * KBO Schedule Optimizer - Authentic 2025 Domain Dataset & Pure Vanilla JS Engine
 * Based on optaplanner-practice (input_2025.json & BaseballEasyScoreCalculator.java)
 */
window.KBO_DATA = {
  "teams": [
    {
      "index": 0,
      "name": "SSG",
      "stadium": "문학경기장",
      "latitude": 37.4351300329305,
      "longitude": 126.690903589028,
      "fullName": "SSG 랜더스",
      "engName": "SSG Landers",
      "city": "인천",
      "address": "인천광역시 미추홀구 매소홀로 618 (문학동)",
      "color": "#CE0E2D",
      "subColor": "#FFB81C",
      "sharedStadium": false,
      "childrenDayHome": false
    },
    {
      "index": 1,
      "name": "두산",
      "stadium": "잠실종합운동장",
      "latitude": 37.5121939926003,
      "longitude": 127.072036416245,
      "fullName": "두산 베어스",
      "engName": "Doosan Bears",
      "city": "서울 잠실",
      "address": "서울특별시 송파구 올림픽로 25 (잠실동)",
      "color": "#131230",
      "subColor": "#ED1C24",
      "sharedStadium": true,
      "childrenDayHome": true
    },
    {
      "index": 2,
      "name": "LG",
      "stadium": "잠실종합운동장",
      "latitude": 37.5121939926003,
      "longitude": 127.072036416245,
      "fullName": "LG 트윈스",
      "engName": "LG Twins",
      "city": "서울 잠실",
      "address": "서울특별시 송파구 올림픽로 25 (잠실동)",
      "color": "#C30452",
      "subColor": "#000000",
      "sharedStadium": true,
      "childrenDayHome": false
    },
    {
      "index": 3,
      "name": "KT",
      "stadium": "수원KT위즈파크",
      "latitude": 37.2998406250231,
      "longitude": 127.009700685327,
      "fullName": "KT 위즈",
      "engName": "KT Wiz",
      "city": "수원",
      "address": "경기도 수원시 장안구 경수대로 893 (조원동)",
      "color": "#000000",
      "subColor": "#EB1C24",
      "sharedStadium": false,
      "childrenDayHome": false
    },
    {
      "index": 4,
      "name": "키움",
      "stadium": "고척돔야구장",
      "latitude": 37.4982926351745,
      "longitude": 126.867136931358,
      "fullName": "키움 히어로즈",
      "engName": "Kiwoom Heroes",
      "city": "서울 고척",
      "address": "서울특별시 구로구 경인로 430 (고척동)",
      "color": "#570514",
      "subColor": "#B07F4A",
      "sharedStadium": false,
      "childrenDayHome": true
    },
    {
      "index": 5,
      "name": "한화",
      "stadium": "한화이글스파크",
      "latitude": 36.3171790770845,
      "longitude": 127.429154900655,
      "fullName": "한화 이글스",
      "engName": "Hanwha Eagles",
      "city": "대전",
      "address": "대전광역시 중구 대종로 373 (부사동)",
      "color": "#FC4E00",
      "subColor": "#07111F",
      "sharedStadium": false,
      "childrenDayHome": true
    },
    {
      "index": 6,
      "name": "삼성",
      "stadium": "대구삼성라이언즈파크",
      "latitude": 35.8413267013148,
      "longitude": 128.681099646757,
      "fullName": "삼성 라이온즈",
      "engName": "Samsung Lions",
      "city": "대구",
      "address": "대구광역시 수성구 야구전설로 1 (연호동)",
      "color": "#074CA1",
      "subColor": "#C0C0C0",
      "sharedStadium": false,
      "childrenDayHome": false
    },
    {
      "index": 7,
      "name": "KIA",
      "stadium": "광주챔피언스필드",
      "latitude": 35.1681165695629,
      "longitude": 126.889145403371,
      "fullName": "KIA 타이거즈",
      "engName": "KIA Tigers",
      "city": "광주",
      "address": "광주광역시 북구 서림로 10 (임동)",
      "color": "#EA0029",
      "subColor": "#06141F",
      "sharedStadium": false,
      "childrenDayHome": false
    },
    {
      "index": 8,
      "name": "NC",
      "stadium": "창원NC파크",
      "latitude": 35.2225640968556,
      "longitude": 128.582270481598,
      "fullName": "NC 다이노스",
      "engName": "NC Dinos",
      "city": "창원",
      "address": "경상남도 창원시 마산회원구 삼호로 63 (양덕동)",
      "color": "#315288",
      "subColor": "#AF917B",
      "sharedStadium": false,
      "childrenDayHome": true
    },
    {
      "index": 9,
      "name": "롯데",
      "stadium": "사직야구장",
      "latitude": 35.1941017214452,
      "longitude": 129.061647044818,
      "fullName": "롯데 자이언츠",
      "engName": "Lotte Giants",
      "city": "부산",
      "address": "부산광역시 동래구 사직로 45 (사직동)",
      "color": "#041E42",
      "subColor": "#D00F31",
      "sharedStadium": false,
      "childrenDayHome": true
    }
  ],
  "stadiumPresets": [
    {
      "stadium": "문학경기장",
      "alias": [
        "인천SSG랜더스필드",
        "문학",
        "인천",
        "SSG"
      ],
      "city": "인천",
      "address": "인천광역시 미추홀구 매소홀로 618",
      "latitude": 37.4351300329305,
      "longitude": 126.690903589028
    },
    {
      "stadium": "잠실종합운동장",
      "alias": [
        "잠실야구장",
        "잠실",
        "서울잠실",
        "두산",
        "LG"
      ],
      "city": "서울 송파",
      "address": "서울특별시 송파구 올림픽로 25",
      "latitude": 37.5121939926003,
      "longitude": 127.072036416245
    },
    {
      "stadium": "수원KT위즈파크",
      "alias": [
        "수원야구장",
        "수원",
        "KT"
      ],
      "city": "경기 수원",
      "address": "경기도 수원시 장안구 경수대로 893",
      "latitude": 37.2998406250231,
      "longitude": 127.009700685327
    },
    {
      "stadium": "고척돔야구장",
      "alias": [
        "고척스카이돔",
        "고척돔",
        "고척",
        "키움"
      ],
      "city": "서울 구로",
      "address": "서울특별시 구로구 경인로 430",
      "latitude": 37.4982926351745,
      "longitude": 126.867136931358
    },
    {
      "stadium": "한화이글스파크",
      "alias": [
        "대전한화생명볼파크",
        "한화생명이글스파크",
        "대전야구장",
        "대전",
        "한화"
      ],
      "city": "대전 중구",
      "address": "대전광역시 중구 대종로 373",
      "latitude": 36.3171790770845,
      "longitude": 127.429154900655
    },
    {
      "stadium": "대구삼성라이언즈파크",
      "alias": [
        "라팍",
        "대구야구장",
        "대구",
        "삼성"
      ],
      "city": "대구 수성",
      "address": "대구광역시 수성구 야구전설로 1",
      "latitude": 35.8413267013148,
      "longitude": 128.681099646757
    },
    {
      "stadium": "광주챔피언스필드",
      "alias": [
        "광주기아챔피언스필드",
        "광주야구장",
        "광주",
        "KIA",
        "기아"
      ],
      "city": "광주 북구",
      "address": "광주광역시 북구 서림로 10",
      "latitude": 35.1681165695629,
      "longitude": 126.889145403371
    },
    {
      "stadium": "창원NC파크",
      "alias": [
        "창원야구장",
        "창원",
        "마산",
        "NC"
      ],
      "city": "경남 창원",
      "address": "경상남도 창원시 마산회원구 삼호로 63",
      "latitude": 35.2225640968556,
      "longitude": 128.582270481598
    },
    {
      "stadium": "사직야구장",
      "alias": [
        "부산사직야구장",
        "사직",
        "부산",
        "롯데"
      ],
      "city": "부산 동래",
      "address": "부산광역시 동래구 사직로 45",
      "latitude": 35.1941017214452,
      "longitude": 129.061647044818
    },
    {
      "stadium": "포항야구장",
      "alias": [
        "포항",
        "삼성제2구장"
      ],
      "city": "경북 포항",
      "address": "경상북도 포항시 남구 희망대로 790",
      "latitude": 36.008132,
      "longitude": 129.359271
    },
    {
      "stadium": "울산문수야구장",
      "alias": [
        "울산",
        "문수야구장",
        "롯데제2구장"
      ],
      "city": "울산 남구",
      "address": "울산광역시 남구 문수로 44",
      "latitude": 35.532168,
      "longitude": 129.265578
    },
    {
      "stadium": "청주야구장",
      "alias": [
        "청주",
        "한화제2구장"
      ],
      "city": "충북 청주",
      "address": "충청북도 청주시 서원구 사직대로 229",
      "latitude": 36.638812,
      "longitude": 127.470065
    },
    {
      "stadium": "군산월명야구장",
      "alias": [
        "군산",
        "월명야구장"
      ],
      "city": "전북 군산",
      "address": "전북특별자치도 군산시 경기장로 24",
      "latitude": 35.963421,
      "longitude": 126.740219
    }
  ],
  "distanceMatrix": [
    {
      "index": 0,
      "from": "SSG",
      "to": "SSG",
      "distance": 0.0
    },
    {
      "index": 1,
      "from": "SSG",
      "to": "두산",
      "distance": 46.2
    },
    {
      "index": 2,
      "from": "SSG",
      "to": "LG",
      "distance": 46.2
    },
    {
      "index": 3,
      "from": "SSG",
      "to": "KT",
      "distance": 43.2
    },
    {
      "index": 4,
      "from": "SSG",
      "to": "키움",
      "distance": 24.9
    },
    {
      "index": 5,
      "from": "SSG",
      "to": "한화",
      "distance": 182.8
    },
    {
      "index": 6,
      "from": "SSG",
      "to": "삼성",
      "distance": 314.1
    },
    {
      "index": 7,
      "from": "SSG",
      "to": "KIA",
      "distance": 312.4
    },
    {
      "index": 8,
      "from": "SSG",
      "to": "NC",
      "distance": 367.4
    },
    {
      "index": 9,
      "from": "SSG",
      "to": "롯데",
      "distance": 405.8
    },
    {
      "index": 10,
      "from": "두산",
      "to": "SSG",
      "distance": 46.2
    },
    {
      "index": 11,
      "from": "두산",
      "to": "두산",
      "distance": 0.0
    },
    {
      "index": 12,
      "from": "두산",
      "to": "LG",
      "distance": 0.0
    },
    {
      "index": 13,
      "from": "두산",
      "to": "KT",
      "distance": 31.4
    },
    {
      "index": 14,
      "from": "두산",
      "to": "키움",
      "distance": 31.1
    },
    {
      "index": 15,
      "from": "두산",
      "to": "한화",
      "distance": 163.7
    },
    {
      "index": 16,
      "from": "두산",
      "to": "삼성",
      "distance": 290.0
    },
    {
      "index": 17,
      "from": "두산",
      "to": "KIA",
      "distance": 291.7
    },
    {
      "index": 18,
      "from": "두산",
      "to": "NC",
      "distance": 343.4
    },
    {
      "index": 19,
      "from": "두산",
      "to": "롯데",
      "distance": 388.9
    },
    {
      "index": 20,
      "from": "LG",
      "to": "SSG",
      "distance": 46.2
    },
    {
      "index": 21,
      "from": "LG",
      "to": "두산",
      "distance": 0.0
    },
    {
      "index": 22,
      "from": "LG",
      "to": "LG",
      "distance": 0.0
    },
    {
      "index": 23,
      "from": "LG",
      "to": "KT",
      "distance": 31.4
    },
    {
      "index": 24,
      "from": "LG",
      "to": "키움",
      "distance": 31.1
    },
    {
      "index": 25,
      "from": "LG",
      "to": "한화",
      "distance": 163.7
    },
    {
      "index": 26,
      "from": "LG",
      "to": "삼성",
      "distance": 290.0
    },
    {
      "index": 27,
      "from": "LG",
      "to": "KIA",
      "distance": 291.7
    },
    {
      "index": 28,
      "from": "LG",
      "to": "NC",
      "distance": 343.4
    },
    {
      "index": 29,
      "from": "LG",
      "to": "롯데",
      "distance": 388.9
    },
    {
      "index": 30,
      "from": "KT",
      "to": "SSG",
      "distance": 43.2
    },
    {
      "index": 31,
      "from": "KT",
      "to": "두산",
      "distance": 31.4
    },
    {
      "index": 32,
      "from": "KT",
      "to": "LG",
      "distance": 31.4
    },
    {
      "index": 33,
      "from": "KT",
      "to": "KT",
      "distance": 0.0
    },
    {
      "index": 34,
      "from": "KT",
      "to": "키움",
      "distance": 39.2
    },
    {
      "index": 35,
      "from": "KT",
      "to": "한화",
      "distance": 143.3
    },
    {
      "index": 36,
      "from": "KT",
      "to": "삼성",
      "distance": 276.2
    },
    {
      "index": 37,
      "from": "KT",
      "to": "KIA",
      "distance": 273.3
    },
    {
      "index": 38,
      "from": "KT",
      "to": "NC",
      "distance": 329.4
    },
    {
      "index": 39,
      "from": "KT",
      "to": "롯데",
      "distance": 375.0
    },
    {
      "index": 40,
      "from": "키움",
      "to": "SSG",
      "distance": 24.9
    },
    {
      "index": 41,
      "from": "키움",
      "to": "두산",
      "distance": 31.1
    },
    {
      "index": 42,
      "from": "키움",
      "to": "LG",
      "distance": 31.1
    },
    {
      "index": 43,
      "from": "키움",
      "to": "KT",
      "distance": 39.2
    },
    {
      "index": 44,
      "from": "키움",
      "to": "키움",
      "distance": 0.0
    },
    {
      "index": 45,
      "from": "키움",
      "to": "한화",
      "distance": 173.4
    },
    {
      "index": 46,
      "from": "키움",
      "to": "삼성",
      "distance": 308.2
    },
    {
      "index": 47,
      "from": "키움",
      "to": "KIA",
      "distance": 311.7
    },
    {
      "index": 48,
      "from": "키움",
      "to": "NC",
      "distance": 361.6
    },
    {
      "index": 49,
      "from": "키움",
      "to": "롯데",
      "distance": 407.2
    },
    {
      "index": 50,
      "from": "한화",
      "to": "SSG",
      "distance": 176.7
    },
    {
      "index": 51,
      "from": "한화",
      "to": "두산",
      "distance": 163.7
    },
    {
      "index": 52,
      "from": "한화",
      "to": "LG",
      "distance": 163.7
    },
    {
      "index": 53,
      "from": "한화",
      "to": "KT",
      "distance": 143.3
    },
    {
      "index": 54,
      "from": "한화",
      "to": "키움",
      "distance": 173.4
    },
    {
      "index": 55,
      "from": "한화",
      "to": "한화",
      "distance": 0.0
    },
    {
      "index": 56,
      "from": "한화",
      "to": "삼성",
      "distance": 161.8
    },
    {
      "index": 57,
      "from": "한화",
      "to": "KIA",
      "distance": 175.6
    },
    {
      "index": 58,
      "from": "한화",
      "to": "NC",
      "distance": 215.2
    },
    {
      "index": 59,
      "from": "한화",
      "to": "롯데",
      "distance": 262.0
    },
    {
      "index": 60,
      "from": "삼성",
      "to": "SSG",
      "distance": 314.1
    },
    {
      "index": 61,
      "from": "삼성",
      "to": "두산",
      "distance": 290.0
    },
    {
      "index": 62,
      "from": "삼성",
      "to": "LG",
      "distance": 290.0
    },
    {
      "index": 63,
      "from": "삼성",
      "to": "KT",
      "distance": 276.2
    },
    {
      "index": 64,
      "from": "삼성",
      "to": "키움",
      "distance": 308.2
    },
    {
      "index": 65,
      "from": "삼성",
      "to": "한화",
      "distance": 161.8
    },
    {
      "index": 66,
      "from": "삼성",
      "to": "삼성",
      "distance": 0.0
    },
    {
      "index": 67,
      "from": "삼성",
      "to": "KIA",
      "distance": 210.8
    },
    {
      "index": 68,
      "from": "삼성",
      "to": "NC",
      "distance": 90.5
    },
    {
      "index": 69,
      "from": "삼성",
      "to": "롯데",
      "distance": 95.8
    },
    {
      "index": 70,
      "from": "KIA",
      "to": "SSG",
      "distance": 312.4
    },
    {
      "index": 71,
      "from": "KIA",
      "to": "두산",
      "distance": 291.7
    },
    {
      "index": 72,
      "from": "KIA",
      "to": "LG",
      "distance": 291.7
    },
    {
      "index": 73,
      "from": "KIA",
      "to": "KT",
      "distance": 273.3
    },
    {
      "index": 74,
      "from": "KIA",
      "to": "키움",
      "distance": 311.7
    },
    {
      "index": 75,
      "from": "KIA",
      "to": "한화",
      "distance": 175.6
    },
    {
      "index": 76,
      "from": "KIA",
      "to": "삼성",
      "distance": 210.8
    },
    {
      "index": 77,
      "from": "KIA",
      "to": "KIA",
      "distance": 0.0
    },
    {
      "index": 78,
      "from": "KIA",
      "to": "NC",
      "distance": 205.3
    },
    {
      "index": 79,
      "from": "KIA",
      "to": "롯데",
      "distance": 254.6
    },
    {
      "index": 80,
      "from": "NC",
      "to": "SSG",
      "distance": 367.4
    },
    {
      "index": 81,
      "from": "NC",
      "to": "두산",
      "distance": 343.4
    },
    {
      "index": 82,
      "from": "NC",
      "to": "LG",
      "distance": 343.4
    },
    {
      "index": 83,
      "from": "NC",
      "to": "KT",
      "distance": 329.4
    },
    {
      "index": 84,
      "from": "NC",
      "to": "키움",
      "distance": 361.6
    },
    {
      "index": 85,
      "from": "NC",
      "to": "한화",
      "distance": 215.2
    },
    {
      "index": 86,
      "from": "NC",
      "to": "삼성",
      "distance": 90.5
    },
    {
      "index": 87,
      "from": "NC",
      "to": "KIA",
      "distance": 205.3
    },
    {
      "index": 88,
      "from": "NC",
      "to": "NC",
      "distance": 0.0
    },
    {
      "index": 89,
      "from": "NC",
      "to": "롯데",
      "distance": 56.9
    },
    {
      "index": 90,
      "from": "롯데",
      "to": "SSG",
      "distance": 405.8
    },
    {
      "index": 91,
      "from": "롯데",
      "to": "두산",
      "distance": 388.9
    },
    {
      "index": 92,
      "from": "롯데",
      "to": "LG",
      "distance": 388.9
    },
    {
      "index": 93,
      "from": "롯데",
      "to": "KT",
      "distance": 375.0
    },
    {
      "index": 94,
      "from": "롯데",
      "to": "키움",
      "distance": 407.2
    },
    {
      "index": 95,
      "from": "롯데",
      "to": "한화",
      "distance": 262.0
    },
    {
      "index": 96,
      "from": "롯데",
      "to": "삼성",
      "distance": 95.8
    },
    {
      "index": 97,
      "from": "롯데",
      "to": "KIA",
      "distance": 254.6
    },
    {
      "index": 98,
      "from": "롯데",
      "to": "NC",
      "distance": 56.9
    },
    {
      "index": 99,
      "from": "롯데",
      "to": "롯데",
      "distance": 0.0
    }
  ],
  "calendar": [
    {
      "index": 0,
      "datetime": "2025-03-22 00:00:00",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 1,
      "datetime": "2025-03-25 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 2,
      "datetime": "2025-03-28 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 3,
      "datetime": "2025-04-01 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 4,
      "datetime": "2025-04-04 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 5,
      "datetime": "2025-04-08 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 6,
      "datetime": "2025-04-11 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 7,
      "datetime": "2025-04-15 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 8,
      "datetime": "2025-04-18 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 9,
      "datetime": "2025-04-22 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 10,
      "datetime": "2025-04-25 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 11,
      "datetime": "2025-04-29 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 12,
      "datetime": "2025-05-02 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 13,
      "datetime": "2025-05-05 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2
    },
    {
      "index": 14,
      "datetime": "2025-05-09 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 15,
      "datetime": "2025-05-13 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 16,
      "datetime": "2025-05-16 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 17,
      "datetime": "2025-05-20 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 18,
      "datetime": "2025-05-23 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 19,
      "datetime": "2025-05-27 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 20,
      "datetime": "2025-05-30 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 21,
      "datetime": "2025-06-03 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 22,
      "datetime": "2025-06-06 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 23,
      "datetime": "2025-06-10 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 24,
      "datetime": "2025-06-13 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 25,
      "datetime": "2025-06-17 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 26,
      "datetime": "2025-06-20 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 27,
      "datetime": "2025-06-24 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 28,
      "datetime": "2025-06-27 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 29,
      "datetime": "2025-07-01 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 30,
      "datetime": "2025-07-04 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 31,
      "datetime": "2025-07-08 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 32,
      "datetime": "2025-07-17 00:00:00",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 33,
      "datetime": "2025-07-22 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 34,
      "datetime": "2025-07-25 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 35,
      "datetime": "2025-07-29 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 36,
      "datetime": "2025-08-01 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 37,
      "datetime": "2025-08-05 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 38,
      "datetime": "2025-08-08 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 39,
      "datetime": "2025-08-12 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 40,
      "datetime": "2025-08-15 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 41,
      "datetime": "2025-08-19 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 42,
      "datetime": "2025-08-22 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 43,
      "datetime": "2025-08-26 00:00:00",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 44,
      "datetime": "2025-08-29 00:00:00",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    }
  ],
  "matches": [
    {
      "index": 0,
      "home": "LG",
      "away": "롯데",
      "consecutive": 2
    },
    {
      "index": 1,
      "home": "SSG",
      "away": "두산",
      "consecutive": 2
    },
    {
      "index": 2,
      "home": "KT",
      "away": "한화",
      "consecutive": 2
    },
    {
      "index": 3,
      "home": "삼성",
      "away": "키움",
      "consecutive": 2
    },
    {
      "index": 4,
      "home": "KIA",
      "away": "NC",
      "consecutive": 2
    },
    {
      "index": 5,
      "home": "LG",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 6,
      "home": "SSG",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 7,
      "home": "KT",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 8,
      "home": "삼성",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 9,
      "home": "KIA",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 10,
      "home": "두산",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 11,
      "home": "키움",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 12,
      "home": "한화",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 13,
      "home": "롯데",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 14,
      "home": "NC",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 15,
      "home": "두산",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 16,
      "home": "KT",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 17,
      "home": "한화",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 18,
      "home": "KIA",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 19,
      "home": "NC",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 20,
      "home": "LG",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 21,
      "home": "키움",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 22,
      "home": "SSG",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 23,
      "home": "삼성",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 24,
      "home": "롯데",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 25,
      "home": "두산",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 26,
      "home": "키움",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 27,
      "home": "KT",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 28,
      "home": "삼성",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 29,
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 30,
      "home": "LG",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 31,
      "home": "KT",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 32,
      "home": "한화",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 33,
      "home": "KIA",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 34,
      "home": "NC",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 35,
      "home": "LG",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 36,
      "home": "SSG",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 37,
      "home": "KIA",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 38,
      "home": "롯데",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 39,
      "home": "NC",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 40,
      "home": "두산",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 41,
      "home": "키움",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 42,
      "home": "SSG",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 43,
      "home": "한화",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 44,
      "home": "삼성",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 45,
      "home": "LG",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 46,
      "home": "키움",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 47,
      "home": "KT",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 48,
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 49,
      "home": "롯데",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 50,
      "home": "두산",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 51,
      "home": "SSG",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 52,
      "home": "한화",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 53,
      "home": "KIA",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 54,
      "home": "NC",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 55,
      "home": "두산",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 56,
      "home": "키움",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 57,
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 58,
      "home": "한화",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 59,
      "home": "NC",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 60,
      "home": "LG",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 61,
      "home": "KT",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 62,
      "home": "삼성",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 63,
      "home": "KIA",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 64,
      "home": "롯데",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 65,
      "home": "두산",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 66,
      "home": "키움",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 67,
      "home": "한화",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 68,
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 69,
      "home": "NC",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 70,
      "home": "두산",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 71,
      "home": "키움",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 72,
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 73,
      "home": "KT",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 74,
      "home": "삼성",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 75,
      "home": "LG",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 76,
      "home": "SSG",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 77,
      "home": "한화",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 78,
      "home": "삼성",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 79,
      "home": "KIA",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 80,
      "home": "LG",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 81,
      "home": "한화",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 82,
      "home": "KIA",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 83,
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 84,
      "home": "NC",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 85,
      "home": "두산",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 86,
      "home": "키움",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 87,
      "home": "KT",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 88,
      "home": "롯데",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 89,
      "home": "NC",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 90,
      "home": "두산",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 91,
      "home": "키움",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 92,
      "home": "SSG",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 93,
      "home": "한화",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 94,
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 95,
      "home": "LG",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 96,
      "home": "SSG",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 97,
      "home": "KT",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 98,
      "home": "삼성",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 99,
      "home": "KIA",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 100,
      "home": "LG",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 101,
      "home": "키움",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 102,
      "home": "KT",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 103,
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 104,
      "home": "NC",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 105,
      "home": "두산",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 106,
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 107,
      "home": "한화",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 108,
      "home": "롯데",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 109,
      "home": "NC",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 110,
      "home": "두산",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 111,
      "home": "키움",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 112,
      "home": "KT",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 113,
      "home": "삼성",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 114,
      "home": "KIA",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 115,
      "home": "LG",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 116,
      "home": "키움",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 117,
      "home": "KT",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 118,
      "home": "한화",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 119,
      "home": "KIA",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 120,
      "home": "두산",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 121,
      "home": "SSG",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 122,
      "home": "한화",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 123,
      "home": "삼성",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 124,
      "home": "NC",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 125,
      "home": "LG",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 126,
      "home": "키움",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 127,
      "home": "삼성",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 128,
      "home": "KIA",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 129,
      "home": "롯데",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 130,
      "home": "LG",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 131,
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 132,
      "home": "KT",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 133,
      "home": "한화",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 134,
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 135,
      "home": "두산",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 136,
      "home": "키움",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 137,
      "home": "KT",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 138,
      "home": "삼성",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 139,
      "home": "NC",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 140,
      "home": "LG",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 141,
      "home": "키움",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 142,
      "home": "SSG",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 143,
      "home": "롯데",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 144,
      "home": "NC",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 145,
      "home": "두산",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 146,
      "home": "KT",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 147,
      "home": "한화",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 148,
      "home": "KIA",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 149,
      "home": "롯데",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 150,
      "home": "두산",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 151,
      "home": "키움",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 152,
      "home": "삼성",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 153,
      "home": "KIA",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 154,
      "home": "NC",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 155,
      "home": "LG",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 156,
      "home": "SSG",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 157,
      "home": "한화",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 158,
      "home": "롯데",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 159,
      "home": "NC",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 160,
      "home": "LG",
      "away": "롯데",
      "consecutive": 4
    },
    {
      "index": 161,
      "home": "SSG",
      "away": "두산",
      "consecutive": 4
    },
    {
      "index": 162,
      "home": "KT",
      "away": "한화",
      "consecutive": 4
    },
    {
      "index": 163,
      "home": "삼성",
      "away": "키움",
      "consecutive": 4
    },
    {
      "index": 164,
      "home": "KIA",
      "away": "NC",
      "consecutive": 4
    },
    {
      "index": 165,
      "home": "두산",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 166,
      "home": "키움",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 167,
      "home": "삼성",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 168,
      "home": "KIA",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 169,
      "home": "NC",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 170,
      "home": "두산",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 171,
      "home": "KT",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 172,
      "home": "한화",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 173,
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 174,
      "home": "NC",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 175,
      "home": "LG",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 176,
      "home": "SSG",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 177,
      "home": "한화",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 178,
      "home": "KIA",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 179,
      "home": "롯데",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 180,
      "home": "두산",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 181,
      "home": "키움",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 182,
      "home": "KT",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 183,
      "home": "삼성",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 184,
      "home": "KIA",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 185,
      "home": "LG",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 186,
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 187,
      "home": "한화",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 188,
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 189,
      "home": "NC",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 190,
      "home": "LG",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 191,
      "home": "키움",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 192,
      "home": "KT",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 193,
      "home": "KIA",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 194,
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 195,
      "home": "두산",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 196,
      "home": "SSG",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 197,
      "home": "KT",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 198,
      "home": "한화",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 199,
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 200,
      "home": "두산",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 201,
      "home": "키움",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 202,
      "home": "SSG",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 203,
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 204,
      "home": "NC",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 205,
      "home": "LG",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 206,
      "home": "KT",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 207,
      "home": "한화",
      "away": "두산",
      "consecutive": 3
    },
    {
      "index": 208,
      "home": "삼성",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 209,
      "home": "KIA",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 210,
      "home": "두산",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 211,
      "home": "한화",
      "away": "SSG",
      "consecutive": 3
    },
    {
      "index": 212,
      "home": "삼성",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 213,
      "home": "KIA",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 214,
      "home": "NC",
      "away": "롯데",
      "consecutive": 3
    },
    {
      "index": 215,
      "home": "두산",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 216,
      "home": "키움",
      "away": "한화",
      "consecutive": 3
    },
    {
      "index": 217,
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 218,
      "home": "롯데",
      "away": "KT",
      "consecutive": 3
    },
    {
      "index": 219,
      "home": "NC",
      "away": "LG",
      "consecutive": 3
    },
    {
      "index": 220,
      "home": "LG",
      "away": "키움",
      "consecutive": 3
    },
    {
      "index": 221,
      "home": "SSG",
      "away": "NC",
      "consecutive": 3
    },
    {
      "index": 222,
      "home": "KT",
      "away": "KIA",
      "consecutive": 3
    },
    {
      "index": 223,
      "home": "한화",
      "away": "삼성",
      "consecutive": 3
    },
    {
      "index": 224,
      "home": "롯데",
      "away": "두산",
      "consecutive": 3
    }
  ],
  "initialPlan": [
    {
      "index": 0,
      "datetime": "2025-03-22 00:00:00",
      "home": "LG",
      "away": "롯데",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 1,
      "datetime": "2025-03-22 00:00:00",
      "home": "SSG",
      "away": "두산",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 2,
      "datetime": "2025-03-22 00:00:00",
      "home": "KT",
      "away": "한화",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 3,
      "datetime": "2025-03-22 00:00:00",
      "home": "삼성",
      "away": "키움",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 4,
      "datetime": "2025-03-22 00:00:00",
      "home": "KIA",
      "away": "NC",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 5,
      "datetime": "2025-03-25 00:00:00",
      "home": "LG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 6,
      "datetime": "2025-03-25 00:00:00",
      "home": "SSG",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 7,
      "datetime": "2025-03-25 00:00:00",
      "home": "KT",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 8,
      "datetime": "2025-03-25 00:00:00",
      "home": "삼성",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 9,
      "datetime": "2025-03-25 00:00:00",
      "home": "KIA",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 10,
      "datetime": "2025-03-28 00:00:00",
      "home": "두산",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 11,
      "datetime": "2025-03-28 00:00:00",
      "home": "키움",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 12,
      "datetime": "2025-03-28 00:00:00",
      "home": "한화",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 13,
      "datetime": "2025-03-28 00:00:00",
      "home": "롯데",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 14,
      "datetime": "2025-03-28 00:00:00",
      "home": "NC",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 15,
      "datetime": "2025-04-01 00:00:00",
      "home": "두산",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 16,
      "datetime": "2025-04-01 00:00:00",
      "home": "KT",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 17,
      "datetime": "2025-04-01 00:00:00",
      "home": "한화",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 18,
      "datetime": "2025-04-01 00:00:00",
      "home": "KIA",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 19,
      "datetime": "2025-04-01 00:00:00",
      "home": "NC",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 20,
      "datetime": "2025-04-04 00:00:00",
      "home": "LG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 21,
      "datetime": "2025-04-04 00:00:00",
      "home": "키움",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 22,
      "datetime": "2025-04-04 00:00:00",
      "home": "SSG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 23,
      "datetime": "2025-04-04 00:00:00",
      "home": "삼성",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 24,
      "datetime": "2025-04-04 00:00:00",
      "home": "롯데",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 25,
      "datetime": "2025-04-08 00:00:00",
      "home": "두산",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 26,
      "datetime": "2025-04-08 00:00:00",
      "home": "키움",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 27,
      "datetime": "2025-04-08 00:00:00",
      "home": "KT",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 28,
      "datetime": "2025-04-08 00:00:00",
      "home": "삼성",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 29,
      "datetime": "2025-04-08 00:00:00",
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 30,
      "datetime": "2025-04-11 00:00:00",
      "home": "LG",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 31,
      "datetime": "2025-04-11 00:00:00",
      "home": "KT",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 32,
      "datetime": "2025-04-11 00:00:00",
      "home": "한화",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 33,
      "datetime": "2025-04-11 00:00:00",
      "home": "KIA",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 34,
      "datetime": "2025-04-11 00:00:00",
      "home": "NC",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 35,
      "datetime": "2025-04-15 00:00:00",
      "home": "LG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 36,
      "datetime": "2025-04-15 00:00:00",
      "home": "SSG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 37,
      "datetime": "2025-04-15 00:00:00",
      "home": "KIA",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 38,
      "datetime": "2025-04-15 00:00:00",
      "home": "롯데",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 39,
      "datetime": "2025-04-15 00:00:00",
      "home": "NC",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 40,
      "datetime": "2025-04-18 00:00:00",
      "home": "두산",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 41,
      "datetime": "2025-04-18 00:00:00",
      "home": "키움",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 42,
      "datetime": "2025-04-18 00:00:00",
      "home": "SSG",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 43,
      "datetime": "2025-04-18 00:00:00",
      "home": "한화",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 44,
      "datetime": "2025-04-18 00:00:00",
      "home": "삼성",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 45,
      "datetime": "2025-04-22 00:00:00",
      "home": "LG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 46,
      "datetime": "2025-04-22 00:00:00",
      "home": "키움",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 47,
      "datetime": "2025-04-22 00:00:00",
      "home": "KT",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 48,
      "datetime": "2025-04-22 00:00:00",
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 49,
      "datetime": "2025-04-22 00:00:00",
      "home": "롯데",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 50,
      "datetime": "2025-04-25 00:00:00",
      "home": "두산",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 51,
      "datetime": "2025-04-25 00:00:00",
      "home": "SSG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 52,
      "datetime": "2025-04-25 00:00:00",
      "home": "한화",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 53,
      "datetime": "2025-04-25 00:00:00",
      "home": "KIA",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 54,
      "datetime": "2025-04-25 00:00:00",
      "home": "NC",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 55,
      "datetime": "2025-04-29 00:00:00",
      "home": "두산",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 56,
      "datetime": "2025-04-29 00:00:00",
      "home": "키움",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 57,
      "datetime": "2025-04-29 00:00:00",
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 58,
      "datetime": "2025-04-29 00:00:00",
      "home": "한화",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 59,
      "datetime": "2025-04-29 00:00:00",
      "home": "NC",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 60,
      "datetime": "2025-05-02 00:00:00",
      "home": "LG",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 61,
      "datetime": "2025-05-02 00:00:00",
      "home": "KT",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 62,
      "datetime": "2025-05-02 00:00:00",
      "home": "삼성",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 63,
      "datetime": "2025-05-02 00:00:00",
      "home": "KIA",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 64,
      "datetime": "2025-05-02 00:00:00",
      "home": "롯데",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 65,
      "datetime": "2025-05-05 00:00:00",
      "home": "두산",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2
    },
    {
      "index": 66,
      "datetime": "2025-05-05 00:00:00",
      "home": "키움",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2
    },
    {
      "index": 67,
      "datetime": "2025-05-05 00:00:00",
      "home": "한화",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2
    },
    {
      "index": 68,
      "datetime": "2025-05-05 00:00:00",
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2
    },
    {
      "index": 69,
      "datetime": "2025-05-05 00:00:00",
      "home": "NC",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2
    },
    {
      "index": 70,
      "datetime": "2025-05-09 00:00:00",
      "home": "두산",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 71,
      "datetime": "2025-05-09 00:00:00",
      "home": "키움",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 72,
      "datetime": "2025-05-09 00:00:00",
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 73,
      "datetime": "2025-05-09 00:00:00",
      "home": "KT",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 74,
      "datetime": "2025-05-09 00:00:00",
      "home": "삼성",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 75,
      "datetime": "2025-05-13 00:00:00",
      "home": "LG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 76,
      "datetime": "2025-05-13 00:00:00",
      "home": "SSG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 77,
      "datetime": "2025-05-13 00:00:00",
      "home": "한화",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 78,
      "datetime": "2025-05-13 00:00:00",
      "home": "삼성",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 79,
      "datetime": "2025-05-13 00:00:00",
      "home": "KIA",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 80,
      "datetime": "2025-05-16 00:00:00",
      "home": "LG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 81,
      "datetime": "2025-05-16 00:00:00",
      "home": "한화",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 82,
      "datetime": "2025-05-16 00:00:00",
      "home": "KIA",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 83,
      "datetime": "2025-05-16 00:00:00",
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 84,
      "datetime": "2025-05-16 00:00:00",
      "home": "NC",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 85,
      "datetime": "2025-05-20 00:00:00",
      "home": "두산",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 86,
      "datetime": "2025-05-20 00:00:00",
      "home": "키움",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 87,
      "datetime": "2025-05-20 00:00:00",
      "home": "KT",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 88,
      "datetime": "2025-05-20 00:00:00",
      "home": "롯데",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 89,
      "datetime": "2025-05-20 00:00:00",
      "home": "NC",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 90,
      "datetime": "2025-05-23 00:00:00",
      "home": "두산",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 91,
      "datetime": "2025-05-23 00:00:00",
      "home": "키움",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 92,
      "datetime": "2025-05-23 00:00:00",
      "home": "SSG",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 93,
      "datetime": "2025-05-23 00:00:00",
      "home": "한화",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 94,
      "datetime": "2025-05-23 00:00:00",
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 95,
      "datetime": "2025-05-27 00:00:00",
      "home": "LG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 96,
      "datetime": "2025-05-27 00:00:00",
      "home": "SSG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 97,
      "datetime": "2025-05-27 00:00:00",
      "home": "KT",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 98,
      "datetime": "2025-05-27 00:00:00",
      "home": "삼성",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 99,
      "datetime": "2025-05-27 00:00:00",
      "home": "KIA",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 100,
      "datetime": "2025-05-30 00:00:00",
      "home": "LG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 101,
      "datetime": "2025-05-30 00:00:00",
      "home": "키움",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 102,
      "datetime": "2025-05-30 00:00:00",
      "home": "KT",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 103,
      "datetime": "2025-05-30 00:00:00",
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 104,
      "datetime": "2025-05-30 00:00:00",
      "home": "NC",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 105,
      "datetime": "2025-06-03 00:00:00",
      "home": "두산",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 106,
      "datetime": "2025-06-03 00:00:00",
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 107,
      "datetime": "2025-06-03 00:00:00",
      "home": "한화",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 108,
      "datetime": "2025-06-03 00:00:00",
      "home": "롯데",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 109,
      "datetime": "2025-06-03 00:00:00",
      "home": "NC",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 110,
      "datetime": "2025-06-06 00:00:00",
      "home": "두산",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 111,
      "datetime": "2025-06-06 00:00:00",
      "home": "키움",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 112,
      "datetime": "2025-06-06 00:00:00",
      "home": "KT",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 113,
      "datetime": "2025-06-06 00:00:00",
      "home": "삼성",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 114,
      "datetime": "2025-06-06 00:00:00",
      "home": "KIA",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 115,
      "datetime": "2025-06-10 00:00:00",
      "home": "LG",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 116,
      "datetime": "2025-06-10 00:00:00",
      "home": "키움",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 117,
      "datetime": "2025-06-10 00:00:00",
      "home": "KT",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 118,
      "datetime": "2025-06-10 00:00:00",
      "home": "한화",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 119,
      "datetime": "2025-06-10 00:00:00",
      "home": "KIA",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 120,
      "datetime": "2025-06-13 00:00:00",
      "home": "두산",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 121,
      "datetime": "2025-06-13 00:00:00",
      "home": "SSG",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 122,
      "datetime": "2025-06-13 00:00:00",
      "home": "한화",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 123,
      "datetime": "2025-06-13 00:00:00",
      "home": "삼성",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 124,
      "datetime": "2025-06-13 00:00:00",
      "home": "NC",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 125,
      "datetime": "2025-06-17 00:00:00",
      "home": "LG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 126,
      "datetime": "2025-06-17 00:00:00",
      "home": "키움",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 127,
      "datetime": "2025-06-17 00:00:00",
      "home": "삼성",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 128,
      "datetime": "2025-06-17 00:00:00",
      "home": "KIA",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 129,
      "datetime": "2025-06-17 00:00:00",
      "home": "롯데",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 130,
      "datetime": "2025-06-20 00:00:00",
      "home": "LG",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 131,
      "datetime": "2025-06-20 00:00:00",
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 132,
      "datetime": "2025-06-20 00:00:00",
      "home": "KT",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 133,
      "datetime": "2025-06-20 00:00:00",
      "home": "한화",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 134,
      "datetime": "2025-06-20 00:00:00",
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 135,
      "datetime": "2025-06-24 00:00:00",
      "home": "두산",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 136,
      "datetime": "2025-06-24 00:00:00",
      "home": "키움",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 137,
      "datetime": "2025-06-24 00:00:00",
      "home": "KT",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 138,
      "datetime": "2025-06-24 00:00:00",
      "home": "삼성",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 139,
      "datetime": "2025-06-24 00:00:00",
      "home": "NC",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 140,
      "datetime": "2025-06-27 00:00:00",
      "home": "LG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 141,
      "datetime": "2025-06-27 00:00:00",
      "home": "키움",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 142,
      "datetime": "2025-06-27 00:00:00",
      "home": "SSG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 143,
      "datetime": "2025-06-27 00:00:00",
      "home": "롯데",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 144,
      "datetime": "2025-06-27 00:00:00",
      "home": "NC",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 145,
      "datetime": "2025-07-01 00:00:00",
      "home": "두산",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 146,
      "datetime": "2025-07-01 00:00:00",
      "home": "KT",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 147,
      "datetime": "2025-07-01 00:00:00",
      "home": "한화",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 148,
      "datetime": "2025-07-01 00:00:00",
      "home": "KIA",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 149,
      "datetime": "2025-07-01 00:00:00",
      "home": "롯데",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 150,
      "datetime": "2025-07-04 00:00:00",
      "home": "두산",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 151,
      "datetime": "2025-07-04 00:00:00",
      "home": "키움",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 152,
      "datetime": "2025-07-04 00:00:00",
      "home": "삼성",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 153,
      "datetime": "2025-07-04 00:00:00",
      "home": "KIA",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 154,
      "datetime": "2025-07-04 00:00:00",
      "home": "NC",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 155,
      "datetime": "2025-07-08 00:00:00",
      "home": "LG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 156,
      "datetime": "2025-07-08 00:00:00",
      "home": "SSG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 157,
      "datetime": "2025-07-08 00:00:00",
      "home": "한화",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 158,
      "datetime": "2025-07-08 00:00:00",
      "home": "롯데",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 159,
      "datetime": "2025-07-08 00:00:00",
      "home": "NC",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 160,
      "datetime": "2025-07-17 00:00:00",
      "home": "LG",
      "away": "롯데",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 161,
      "datetime": "2025-07-17 00:00:00",
      "home": "SSG",
      "away": "두산",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 162,
      "datetime": "2025-07-17 00:00:00",
      "home": "KT",
      "away": "한화",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 163,
      "datetime": "2025-07-17 00:00:00",
      "home": "삼성",
      "away": "키움",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 164,
      "datetime": "2025-07-17 00:00:00",
      "home": "KIA",
      "away": "NC",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 165,
      "datetime": "2025-07-22 00:00:00",
      "home": "두산",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 166,
      "datetime": "2025-07-22 00:00:00",
      "home": "키움",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 167,
      "datetime": "2025-07-22 00:00:00",
      "home": "삼성",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 168,
      "datetime": "2025-07-22 00:00:00",
      "home": "KIA",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 169,
      "datetime": "2025-07-22 00:00:00",
      "home": "NC",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 170,
      "datetime": "2025-07-25 00:00:00",
      "home": "두산",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 171,
      "datetime": "2025-07-25 00:00:00",
      "home": "KT",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 172,
      "datetime": "2025-07-25 00:00:00",
      "home": "한화",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 173,
      "datetime": "2025-07-25 00:00:00",
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 174,
      "datetime": "2025-07-25 00:00:00",
      "home": "NC",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 175,
      "datetime": "2025-07-29 00:00:00",
      "home": "LG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 176,
      "datetime": "2025-07-29 00:00:00",
      "home": "SSG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 177,
      "datetime": "2025-07-29 00:00:00",
      "home": "한화",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 178,
      "datetime": "2025-07-29 00:00:00",
      "home": "KIA",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 179,
      "datetime": "2025-07-29 00:00:00",
      "home": "롯데",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 180,
      "datetime": "2025-08-01 00:00:00",
      "home": "두산",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 181,
      "datetime": "2025-08-01 00:00:00",
      "home": "키움",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 182,
      "datetime": "2025-08-01 00:00:00",
      "home": "KT",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 183,
      "datetime": "2025-08-01 00:00:00",
      "home": "삼성",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 184,
      "datetime": "2025-08-01 00:00:00",
      "home": "KIA",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 185,
      "datetime": "2025-08-05 00:00:00",
      "home": "LG",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 186,
      "datetime": "2025-08-05 00:00:00",
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 187,
      "datetime": "2025-08-05 00:00:00",
      "home": "한화",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 188,
      "datetime": "2025-08-05 00:00:00",
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 189,
      "datetime": "2025-08-05 00:00:00",
      "home": "NC",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 190,
      "datetime": "2025-08-08 00:00:00",
      "home": "LG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 191,
      "datetime": "2025-08-08 00:00:00",
      "home": "키움",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 192,
      "datetime": "2025-08-08 00:00:00",
      "home": "KT",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 193,
      "datetime": "2025-08-08 00:00:00",
      "home": "KIA",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 194,
      "datetime": "2025-08-08 00:00:00",
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 195,
      "datetime": "2025-08-12 00:00:00",
      "home": "두산",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 196,
      "datetime": "2025-08-12 00:00:00",
      "home": "SSG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 197,
      "datetime": "2025-08-12 00:00:00",
      "home": "KT",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 198,
      "datetime": "2025-08-12 00:00:00",
      "home": "한화",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 199,
      "datetime": "2025-08-12 00:00:00",
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 200,
      "datetime": "2025-08-15 00:00:00",
      "home": "두산",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 201,
      "datetime": "2025-08-15 00:00:00",
      "home": "키움",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 202,
      "datetime": "2025-08-15 00:00:00",
      "home": "SSG",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 203,
      "datetime": "2025-08-15 00:00:00",
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 204,
      "datetime": "2025-08-15 00:00:00",
      "home": "NC",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3
    },
    {
      "index": 205,
      "datetime": "2025-08-19 00:00:00",
      "home": "LG",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 206,
      "datetime": "2025-08-19 00:00:00",
      "home": "KT",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 207,
      "datetime": "2025-08-19 00:00:00",
      "home": "한화",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 208,
      "datetime": "2025-08-19 00:00:00",
      "home": "삼성",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 209,
      "datetime": "2025-08-19 00:00:00",
      "home": "KIA",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 210,
      "datetime": "2025-08-22 00:00:00",
      "home": "두산",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 211,
      "datetime": "2025-08-22 00:00:00",
      "home": "한화",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 212,
      "datetime": "2025-08-22 00:00:00",
      "home": "삼성",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 213,
      "datetime": "2025-08-22 00:00:00",
      "home": "KIA",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 214,
      "datetime": "2025-08-22 00:00:00",
      "home": "NC",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 215,
      "datetime": "2025-08-26 00:00:00",
      "home": "두산",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 216,
      "datetime": "2025-08-26 00:00:00",
      "home": "키움",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 217,
      "datetime": "2025-08-26 00:00:00",
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 218,
      "datetime": "2025-08-26 00:00:00",
      "home": "롯데",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 219,
      "datetime": "2025-08-26 00:00:00",
      "home": "NC",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0
    },
    {
      "index": 220,
      "datetime": "2025-08-29 00:00:00",
      "home": "LG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 221,
      "datetime": "2025-08-29 00:00:00",
      "home": "SSG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 222,
      "datetime": "2025-08-29 00:00:00",
      "home": "KT",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 223,
      "datetime": "2025-08-29 00:00:00",
      "home": "한화",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    },
    {
      "index": 224,
      "datetime": "2025-08-29 00:00:00",
      "home": "롯데",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2
    }
  ],
  "solvedPlan": [
    {
      "index": 0,
      "datetime": "2025-03-22 00:00:00",
      "home": "LG",
      "away": "롯데",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 1,
      "datetime": "2025-03-22 00:00:00",
      "home": "SSG",
      "away": "두산",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 2,
      "datetime": "2025-03-22 00:00:00",
      "home": "KT",
      "away": "한화",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 3,
      "datetime": "2025-03-22 00:00:00",
      "home": "삼성",
      "away": "키움",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 4,
      "datetime": "2025-03-22 00:00:00",
      "home": "KIA",
      "away": "NC",
      "consecutive": 2,
      "weekend": 1,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 5,
      "datetime": "2025-03-25 00:00:00",
      "home": "키움",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 6,
      "datetime": "2025-03-25 00:00:00",
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 7,
      "datetime": "2025-03-25 00:00:00",
      "home": "KIA",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 8,
      "datetime": "2025-03-25 00:00:00",
      "home": "두산",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 9,
      "datetime": "2025-03-25 00:00:00",
      "home": "한화",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 10,
      "datetime": "2025-03-28 00:00:00",
      "home": "두산",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 11,
      "datetime": "2025-03-28 00:00:00",
      "home": "NC",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 12,
      "datetime": "2025-03-28 00:00:00",
      "home": "KIA",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 13,
      "datetime": "2025-03-28 00:00:00",
      "home": "KT",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 14,
      "datetime": "2025-03-28 00:00:00",
      "home": "한화",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 15,
      "datetime": "2025-04-01 00:00:00",
      "home": "키움",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 16,
      "datetime": "2025-04-01 00:00:00",
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 17,
      "datetime": "2025-04-01 00:00:00",
      "home": "KT",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 18,
      "datetime": "2025-04-01 00:00:00",
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 19,
      "datetime": "2025-04-01 00:00:00",
      "home": "두산",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 20,
      "datetime": "2025-04-04 00:00:00",
      "home": "LG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 21,
      "datetime": "2025-04-04 00:00:00",
      "home": "삼성",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 22,
      "datetime": "2025-04-04 00:00:00",
      "home": "키움",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 23,
      "datetime": "2025-04-04 00:00:00",
      "home": "KT",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 24,
      "datetime": "2025-04-04 00:00:00",
      "home": "롯데",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 25,
      "datetime": "2025-04-08 00:00:00",
      "home": "SSG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 26,
      "datetime": "2025-04-08 00:00:00",
      "home": "삼성",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 27,
      "datetime": "2025-04-08 00:00:00",
      "home": "한화",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 28,
      "datetime": "2025-04-08 00:00:00",
      "home": "두산",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 29,
      "datetime": "2025-04-08 00:00:00",
      "home": "롯데",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 30,
      "datetime": "2025-04-11 00:00:00",
      "home": "KT",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 31,
      "datetime": "2025-04-11 00:00:00",
      "home": "한화",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 32,
      "datetime": "2025-04-11 00:00:00",
      "home": "KIA",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 33,
      "datetime": "2025-04-11 00:00:00",
      "home": "NC",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 34,
      "datetime": "2025-04-11 00:00:00",
      "home": "LG",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 35,
      "datetime": "2025-04-15 00:00:00",
      "home": "LG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 36,
      "datetime": "2025-04-15 00:00:00",
      "home": "SSG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 37,
      "datetime": "2025-04-15 00:00:00",
      "home": "롯데",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 38,
      "datetime": "2025-04-15 00:00:00",
      "home": "KT",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 39,
      "datetime": "2025-04-15 00:00:00",
      "home": "NC",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 40,
      "datetime": "2025-04-18 00:00:00",
      "home": "삼성",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 41,
      "datetime": "2025-04-18 00:00:00",
      "home": "키움",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 42,
      "datetime": "2025-04-18 00:00:00",
      "home": "SSG",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 43,
      "datetime": "2025-04-18 00:00:00",
      "home": "두산",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 44,
      "datetime": "2025-04-18 00:00:00",
      "home": "한화",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 45,
      "datetime": "2025-04-22 00:00:00",
      "home": "롯데",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 46,
      "datetime": "2025-04-22 00:00:00",
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 47,
      "datetime": "2025-04-22 00:00:00",
      "home": "KT",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 48,
      "datetime": "2025-04-22 00:00:00",
      "home": "LG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 49,
      "datetime": "2025-04-22 00:00:00",
      "home": "키움",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 50,
      "datetime": "2025-04-25 00:00:00",
      "home": "두산",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 51,
      "datetime": "2025-04-25 00:00:00",
      "home": "KIA",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 52,
      "datetime": "2025-04-25 00:00:00",
      "home": "한화",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 53,
      "datetime": "2025-04-25 00:00:00",
      "home": "NC",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 54,
      "datetime": "2025-04-25 00:00:00",
      "home": "SSG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 55,
      "datetime": "2025-04-29 00:00:00",
      "home": "키움",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 56,
      "datetime": "2025-04-29 00:00:00",
      "home": "한화",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 57,
      "datetime": "2025-04-29 00:00:00",
      "home": "NC",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 58,
      "datetime": "2025-04-29 00:00:00",
      "home": "두산",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 59,
      "datetime": "2025-04-29 00:00:00",
      "home": "삼성",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 60,
      "datetime": "2025-05-02 00:00:00",
      "home": "KT",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 61,
      "datetime": "2025-05-02 00:00:00",
      "home": "삼성",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 62,
      "datetime": "2025-05-02 00:00:00",
      "home": "KIA",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 63,
      "datetime": "2025-05-02 00:00:00",
      "home": "LG",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 64,
      "datetime": "2025-05-02 00:00:00",
      "home": "롯데",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 65,
      "datetime": "2025-05-05 00:00:00",
      "home": "두산",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 66,
      "datetime": "2025-05-05 00:00:00",
      "home": "NC",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 67,
      "datetime": "2025-05-05 00:00:00",
      "home": "키움",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 68,
      "datetime": "2025-05-05 00:00:00",
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 69,
      "datetime": "2025-05-05 00:00:00",
      "home": "한화",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 2,
      "pinned": true
    },
    {
      "index": 70,
      "datetime": "2025-05-09 00:00:00",
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 71,
      "datetime": "2025-05-09 00:00:00",
      "home": "한화",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 72,
      "datetime": "2025-05-09 00:00:00",
      "home": "두산",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 73,
      "datetime": "2025-05-09 00:00:00",
      "home": "키움",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 74,
      "datetime": "2025-05-09 00:00:00",
      "home": "NC",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 75,
      "datetime": "2025-05-13 00:00:00",
      "home": "LG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 76,
      "datetime": "2025-05-13 00:00:00",
      "home": "KT",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 77,
      "datetime": "2025-05-13 00:00:00",
      "home": "삼성",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 78,
      "datetime": "2025-05-13 00:00:00",
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 79,
      "datetime": "2025-05-13 00:00:00",
      "home": "KIA",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 80,
      "datetime": "2025-05-16 00:00:00",
      "home": "KIA",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 81,
      "datetime": "2025-05-16 00:00:00",
      "home": "롯데",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 82,
      "datetime": "2025-05-16 00:00:00",
      "home": "NC",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 83,
      "datetime": "2025-05-16 00:00:00",
      "home": "키움",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 84,
      "datetime": "2025-05-16 00:00:00",
      "home": "두산",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 85,
      "datetime": "2025-05-20 00:00:00",
      "home": "삼성",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 86,
      "datetime": "2025-05-20 00:00:00",
      "home": "KIA",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 87,
      "datetime": "2025-05-20 00:00:00",
      "home": "LG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 88,
      "datetime": "2025-05-20 00:00:00",
      "home": "한화",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 89,
      "datetime": "2025-05-20 00:00:00",
      "home": "SSG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 90,
      "datetime": "2025-05-23 00:00:00",
      "home": "SSG",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 91,
      "datetime": "2025-05-23 00:00:00",
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 92,
      "datetime": "2025-05-23 00:00:00",
      "home": "두산",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 93,
      "datetime": "2025-05-23 00:00:00",
      "home": "KT",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 94,
      "datetime": "2025-05-23 00:00:00",
      "home": "키움",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 95,
      "datetime": "2025-05-27 00:00:00",
      "home": "SSG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 96,
      "datetime": "2025-05-27 00:00:00",
      "home": "KT",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 97,
      "datetime": "2025-05-27 00:00:00",
      "home": "KIA",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 98,
      "datetime": "2025-05-27 00:00:00",
      "home": "LG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 99,
      "datetime": "2025-05-27 00:00:00",
      "home": "롯데",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 100,
      "datetime": "2025-05-30 00:00:00",
      "home": "NC",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 101,
      "datetime": "2025-05-30 00:00:00",
      "home": "LG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 102,
      "datetime": "2025-05-30 00:00:00",
      "home": "키움",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 103,
      "datetime": "2025-05-30 00:00:00",
      "home": "롯데",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 104,
      "datetime": "2025-05-30 00:00:00",
      "home": "KT",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 105,
      "datetime": "2025-06-03 00:00:00",
      "home": "NC",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 106,
      "datetime": "2025-06-03 00:00:00",
      "home": "한화",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 107,
      "datetime": "2025-06-03 00:00:00",
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 108,
      "datetime": "2025-06-03 00:00:00",
      "home": "롯데",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 109,
      "datetime": "2025-06-03 00:00:00",
      "home": "두산",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 110,
      "datetime": "2025-06-06 00:00:00",
      "home": "SSG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 111,
      "datetime": "2025-06-06 00:00:00",
      "home": "KIA",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 112,
      "datetime": "2025-06-06 00:00:00",
      "home": "두산",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 113,
      "datetime": "2025-06-06 00:00:00",
      "home": "키움",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 114,
      "datetime": "2025-06-06 00:00:00",
      "home": "삼성",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 115,
      "datetime": "2025-06-10 00:00:00",
      "home": "KIA",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 116,
      "datetime": "2025-06-10 00:00:00",
      "home": "LG",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 117,
      "datetime": "2025-06-10 00:00:00",
      "home": "KT",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 118,
      "datetime": "2025-06-10 00:00:00",
      "home": "한화",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 119,
      "datetime": "2025-06-10 00:00:00",
      "home": "NC",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 120,
      "datetime": "2025-06-13 00:00:00",
      "home": "SSG",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 121,
      "datetime": "2025-06-13 00:00:00",
      "home": "한화",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 122,
      "datetime": "2025-06-13 00:00:00",
      "home": "NC",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 123,
      "datetime": "2025-06-13 00:00:00",
      "home": "삼성",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 124,
      "datetime": "2025-06-13 00:00:00",
      "home": "두산",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 125,
      "datetime": "2025-06-17 00:00:00",
      "home": "키움",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 126,
      "datetime": "2025-06-17 00:00:00",
      "home": "롯데",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 127,
      "datetime": "2025-06-17 00:00:00",
      "home": "KIA",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 128,
      "datetime": "2025-06-17 00:00:00",
      "home": "삼성",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 129,
      "datetime": "2025-06-17 00:00:00",
      "home": "LG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 130,
      "datetime": "2025-06-20 00:00:00",
      "home": "삼성",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 131,
      "datetime": "2025-06-20 00:00:00",
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 132,
      "datetime": "2025-06-20 00:00:00",
      "home": "LG",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 133,
      "datetime": "2025-06-20 00:00:00",
      "home": "한화",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 134,
      "datetime": "2025-06-20 00:00:00",
      "home": "KT",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 135,
      "datetime": "2025-06-24 00:00:00",
      "home": "롯데",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 136,
      "datetime": "2025-06-24 00:00:00",
      "home": "NC",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 137,
      "datetime": "2025-06-24 00:00:00",
      "home": "키움",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 138,
      "datetime": "2025-06-24 00:00:00",
      "home": "LG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 139,
      "datetime": "2025-06-24 00:00:00",
      "home": "SSG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 140,
      "datetime": "2025-06-27 00:00:00",
      "home": "KT",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 141,
      "datetime": "2025-06-27 00:00:00",
      "home": "키움",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 142,
      "datetime": "2025-06-27 00:00:00",
      "home": "한화",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 143,
      "datetime": "2025-06-27 00:00:00",
      "home": "두산",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 144,
      "datetime": "2025-06-27 00:00:00",
      "home": "NC",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 145,
      "datetime": "2025-07-01 00:00:00",
      "home": "두산",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 146,
      "datetime": "2025-07-01 00:00:00",
      "home": "키움",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 147,
      "datetime": "2025-07-01 00:00:00",
      "home": "KIA",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 148,
      "datetime": "2025-07-01 00:00:00",
      "home": "NC",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 149,
      "datetime": "2025-07-01 00:00:00",
      "home": "삼성",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 150,
      "datetime": "2025-07-04 00:00:00",
      "home": "한화",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 151,
      "datetime": "2025-07-04 00:00:00",
      "home": "KT",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 152,
      "datetime": "2025-07-04 00:00:00",
      "home": "KIA",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 153,
      "datetime": "2025-07-04 00:00:00",
      "home": "롯데",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 154,
      "datetime": "2025-07-04 00:00:00",
      "home": "두산",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 155,
      "datetime": "2025-07-08 00:00:00",
      "home": "한화",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 156,
      "datetime": "2025-07-08 00:00:00",
      "home": "NC",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 157,
      "datetime": "2025-07-08 00:00:00",
      "home": "SSG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 158,
      "datetime": "2025-07-08 00:00:00",
      "home": "롯데",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 159,
      "datetime": "2025-07-08 00:00:00",
      "home": "LG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 160,
      "datetime": "2025-07-17 00:00:00",
      "home": "LG",
      "away": "롯데",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 161,
      "datetime": "2025-07-17 00:00:00",
      "home": "SSG",
      "away": "두산",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 162,
      "datetime": "2025-07-17 00:00:00",
      "home": "KT",
      "away": "한화",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 163,
      "datetime": "2025-07-17 00:00:00",
      "home": "삼성",
      "away": "키움",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 164,
      "datetime": "2025-07-17 00:00:00",
      "home": "KIA",
      "away": "NC",
      "consecutive": 4,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 165,
      "datetime": "2025-07-22 00:00:00",
      "home": "두산",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 166,
      "datetime": "2025-07-22 00:00:00",
      "home": "키움",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 167,
      "datetime": "2025-07-22 00:00:00",
      "home": "NC",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 168,
      "datetime": "2025-07-22 00:00:00",
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 169,
      "datetime": "2025-07-22 00:00:00",
      "home": "KIA",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 170,
      "datetime": "2025-07-25 00:00:00",
      "home": "한화",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 171,
      "datetime": "2025-07-25 00:00:00",
      "home": "NC",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 172,
      "datetime": "2025-07-25 00:00:00",
      "home": "LG",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 173,
      "datetime": "2025-07-25 00:00:00",
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 174,
      "datetime": "2025-07-25 00:00:00",
      "home": "KT",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 175,
      "datetime": "2025-07-29 00:00:00",
      "home": "LG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 176,
      "datetime": "2025-07-29 00:00:00",
      "home": "키움",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 177,
      "datetime": "2025-07-29 00:00:00",
      "home": "삼성",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 178,
      "datetime": "2025-07-29 00:00:00",
      "home": "KIA",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 179,
      "datetime": "2025-07-29 00:00:00",
      "home": "롯데",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 180,
      "datetime": "2025-08-01 00:00:00",
      "home": "KT",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 181,
      "datetime": "2025-08-01 00:00:00",
      "home": "삼성",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 182,
      "datetime": "2025-08-01 00:00:00",
      "home": "두산",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 183,
      "datetime": "2025-08-01 00:00:00",
      "home": "키움",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 184,
      "datetime": "2025-08-01 00:00:00",
      "home": "KIA",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 185,
      "datetime": "2025-08-05 00:00:00",
      "home": "키움",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 186,
      "datetime": "2025-08-05 00:00:00",
      "home": "LG",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 187,
      "datetime": "2025-08-05 00:00:00",
      "home": "SSG",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 188,
      "datetime": "2025-08-05 00:00:00",
      "home": "KT",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 189,
      "datetime": "2025-08-05 00:00:00",
      "home": "KIA",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 190,
      "datetime": "2025-08-08 00:00:00",
      "home": "SSG",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 191,
      "datetime": "2025-08-08 00:00:00",
      "home": "두산",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 192,
      "datetime": "2025-08-08 00:00:00",
      "home": "한화",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 193,
      "datetime": "2025-08-08 00:00:00",
      "home": "롯데",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 194,
      "datetime": "2025-08-08 00:00:00",
      "home": "NC",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 195,
      "datetime": "2025-08-12 00:00:00",
      "home": "LG",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 196,
      "datetime": "2025-08-12 00:00:00",
      "home": "한화",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 197,
      "datetime": "2025-08-12 00:00:00",
      "home": "KIA",
      "away": "두산",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 198,
      "datetime": "2025-08-12 00:00:00",
      "home": "삼성",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 199,
      "datetime": "2025-08-12 00:00:00",
      "home": "NC",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 200,
      "datetime": "2025-08-15 00:00:00",
      "home": "두산",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 201,
      "datetime": "2025-08-15 00:00:00",
      "home": "NC",
      "away": "LG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 202,
      "datetime": "2025-08-15 00:00:00",
      "home": "롯데",
      "away": "KT",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 203,
      "datetime": "2025-08-15 00:00:00",
      "home": "키움",
      "away": "한화",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 204,
      "datetime": "2025-08-15 00:00:00",
      "home": "SSG",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 3,
      "pinned": false
    },
    {
      "index": 205,
      "datetime": "2025-08-19 00:00:00",
      "home": "한화",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 206,
      "datetime": "2025-08-19 00:00:00",
      "home": "두산",
      "away": "NC",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 207,
      "datetime": "2025-08-19 00:00:00",
      "home": "KT",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 208,
      "datetime": "2025-08-19 00:00:00",
      "home": "SSG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 209,
      "datetime": "2025-08-19 00:00:00",
      "home": "삼성",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 210,
      "datetime": "2025-08-22 00:00:00",
      "home": "KIA",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 211,
      "datetime": "2025-08-22 00:00:00",
      "home": "KT",
      "away": "SSG",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 212,
      "datetime": "2025-08-22 00:00:00",
      "home": "삼성",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 213,
      "datetime": "2025-08-22 00:00:00",
      "home": "한화",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 214,
      "datetime": "2025-08-22 00:00:00",
      "home": "LG",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 215,
      "datetime": "2025-08-26 00:00:00",
      "home": "두산",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 216,
      "datetime": "2025-08-26 00:00:00",
      "home": "키움",
      "away": "KT",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 217,
      "datetime": "2025-08-26 00:00:00",
      "home": "삼성",
      "away": "롯데",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 218,
      "datetime": "2025-08-26 00:00:00",
      "home": "SSG",
      "away": "LG",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 219,
      "datetime": "2025-08-26 00:00:00",
      "home": "NC",
      "away": "한화",
      "consecutive": 3,
      "weekend": 0,
      "holiday": 0,
      "pinned": false
    },
    {
      "index": 220,
      "datetime": "2025-08-29 00:00:00",
      "home": "롯데",
      "away": "두산",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 221,
      "datetime": "2025-08-29 00:00:00",
      "home": "LG",
      "away": "키움",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 222,
      "datetime": "2025-08-29 00:00:00",
      "home": "SSG",
      "away": "NC",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 223,
      "datetime": "2025-08-29 00:00:00",
      "home": "KT",
      "away": "KIA",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    },
    {
      "index": 224,
      "datetime": "2025-08-29 00:00:00",
      "home": "한화",
      "away": "삼성",
      "consecutive": 3,
      "weekend": 1,
      "holiday": 2,
      "pinned": false
    }
  ]
};

window.KBOEngine = (function() {
  const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function parseDateStr(dtStr) {
    const clean = String(dtStr).trim().slice(0, 10);
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getDayOfWeekKo(dtStr) {
    const d = parseDateStr(dtStr);
    return DAY_NAMES_KO[d.getDay()];
  }

  // Haversine formula (km)
  function haversineKm(lat1, lon1, lat2, lon2) {
    if (Math.abs(lat1 - lat2) < 1e-6 && Math.abs(lon1 - lon2) < 1e-6) return 0.0;
    const R = 6371.0;
    const dLat = (lat2 - lat1) * Math.PI / 180.0;
    const dLon = (lon2 - lon1) * Math.PI / 180.0;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Auto-geocode stadium or address (Preset dictionary + OpenStreetMap Nominatim + Kakao/Naver support)
  async function geocodeLocation(query, apiConfig = {}) {
    const q = String(query || '').trim();
    if (!q) return null;

    // 1. Check built-in stadium presets first (instant & accurate)
    for (const preset of window.KBO_DATA.stadiumPresets) {
      if (preset.stadium.includes(q) || q.includes(preset.stadium) ||
          preset.address.includes(q) || preset.alias.some(a => q.includes(a) || a.includes(q))) {
        return {
          stadium: preset.stadium,
          address: preset.address,
          city: preset.city,
          latitude: preset.latitude,
          longitude: preset.longitude,
          source: 'KBO 구장 좌표 DB (자동 매칭)'
        };
      }
    }

    // 2. If Kakao Map JS SDK geocoder is loaded on page
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      try {
        const geocoder = new window.kakao.maps.services.Geocoder();
        const places = new window.kakao.maps.services.Places();
        const res = await new Promise((resolve) => {
          places.keywordSearch(q, (data, status) => {
            if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
              resolve({
                stadium: data[0].place_name || q,
                address: data[0].road_address_name || data[0].address_name,
                latitude: parseFloat(data[0].y),
                longitude: parseFloat(data[0].x),
                source: 'Kakao Map Places API'
              });
            } else {
              geocoder.addressSearch(q, (addrData, addrStatus) => {
                if (addrStatus === window.kakao.maps.services.Status.OK && addrData.length > 0) {
                  resolve({
                    stadium: q,
                    address: addrData[0].address_name,
                    latitude: parseFloat(addrData[0].y),
                    longitude: parseFloat(addrData[0].x),
                    source: 'Kakao Map Geocoder API'
                  });
                } else {
                  resolve(null);
                }
              });
            }
          });
        });
        if (res) return res;
      } catch (e) {
        console.warn('Kakao geocode fallback:', e);
      }
    }

    // 3. Try OpenStreetMap Nominatim public geocoding API for any Korean address
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
      if (resp.ok) {
        const items = await resp.json();
        if (items && items.length > 0) {
          return {
            stadium: q,
            address: items[0].display_name,
            latitude: parseFloat(parseFloat(items[0].lat).toFixed(7)),
            longitude: parseFloat(parseFloat(items[0].lon).toFixed(7)),
            source: 'Map Geocoding API (OSM)'
          };
        }
      }
    } catch (e) {
      // Offline fallback
    }

    // 4. Fallback regional coordinates in Korea
    const regionFallback = {
      '서울': [37.5665, 126.9780], '인천': [37.4563, 126.7052], '수원': [37.2636, 127.0286],
      '대전': [36.3504, 127.3845], '대구': [35.8714, 128.6014], '광주': [35.1595, 126.8526],
      '부산': [35.1796, 129.0756], '창원': [35.2280, 128.6811], '울산': [35.5384, 129.3114],
      '포항': [36.0190, 129.3435], '청주': [36.6424, 127.4890], '제주': [33.4996, 126.5312]
    };
    for (const [city, [lat, lng]] of Object.entries(regionFallback)) {
      if (q.includes(city)) {
        return {
          stadium: q,
          address: `${city} 지역 구장`,
          latitude: lat,
          longitude: lng,
          source: '국내 주요 도시 좌표 DB'
        };
      }
    }
    return null;
  }

  // Build distance lookup map { fromTeam: { toTeam: km } }
  function buildDistanceLookup(teams, distanceMatrix) {
    const lookup = {};
    teams.forEach(t => { lookup[t.name] = {}; });
    if (Array.isArray(distanceMatrix)) {
      distanceMatrix.forEach(entry => {
        if (!lookup[entry.from]) lookup[entry.from] = {};
        lookup[entry.from][entry.to] = Number(entry.distance);
      });
    }
    // Fill any missing pairs with calibrated road distance
    teams.forEach(fromT => {
      teams.forEach(toT => {
        if (lookup[fromT.name][toT.name] === undefined) {
          if (fromT.name === toT.name || (fromT.stadium && fromT.stadium === toT.stadium)) {
            lookup[fromT.name][toT.name] = 0.0;
          } else {
            const straight = haversineKm(fromT.latitude, fromT.longitude, toT.latitude, toT.longitude);
            lookup[fromT.name][toT.name] = Number((straight * 1.29).toFixed(1));
          }
        }
      });
    });
    return lookup;
  }

  // Recalculate 10x10 road distance matrix from coordinates (Map Route API + KBO calibration)
  async function calculateDistanceMatrixFromCoords(teams, options = {}) {
    const defaultLookup = {};
    window.KBO_DATA.distanceMatrix.forEach(d => {
      if (!defaultLookup[d.from]) defaultLookup[d.from] = {};
      defaultLookup[d.from][d.to] = d.distance;
    });
    const defaultTeamsByName = {};
    window.KBO_DATA.teams.forEach(t => { defaultTeamsByName[t.name] = t; });

    const matrix = [];
    let idx = 0;

    // Optional OSRM table route call if online & requested
    let osrmMatrix = null;
    if (options.useLiveRouteApi) {
      try {
        const coordsStr = teams.map(t => `${t.longitude},${t.latitude}`).join(';');
        const url = `https://router.project-osrm.org/table/v1/driving/${coordsStr}?annotations=distance`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.distances) {
            osrmMatrix = data.distances; // meters
          }
        }
      } catch (e) {
        // Fallback to calibrated road formula
      }
    }

    for (let i = 0; i < teams.length; i++) {
      for (let j = 0; j < teams.length; j++) {
        const fromT = teams[i];
        const toT = teams[j];
        let distKm = 0.0;

        const sameLocation = (i === j) ||
          (fromT.stadium && fromT.stadium === toT.stadium &&
           Math.abs(fromT.latitude - toT.latitude) < 1e-4 &&
           Math.abs(fromT.longitude - toT.longitude) < 1e-4);

        if (sameLocation) {
          distKm = 0.0;
        } else {
          const defFrom = defaultTeamsByName[fromT.name];
          const defTo = defaultTeamsByName[toT.name];
          const unchangedFromDefault = defFrom && defTo &&
            Math.abs(defFrom.latitude - fromT.latitude) < 1e-4 &&
            Math.abs(defFrom.longitude - fromT.longitude) < 1e-4 &&
            Math.abs(defTo.latitude - toT.latitude) < 1e-4 &&
            Math.abs(defTo.longitude - toT.longitude) < 1e-4;

          if (unchangedFromDefault && defaultLookup[fromT.name] && defaultLookup[fromT.name][toT.name] !== undefined && !options.forceFormula) {
            distKm = defaultLookup[fromT.name][toT.name];
          } else if (osrmMatrix && osrmMatrix[i] && osrmMatrix[i][j] != null) {
            distKm = Number((osrmMatrix[i][j] / 1000.0).toFixed(1));
          } else {
            const straight = haversineKm(fromT.latitude, fromT.longitude, toT.latitude, toT.longitude);
            const roadFactor = straight < 50 ? 1.34 : (straight < 180 ? 1.26 : 1.29);
            distKm = Number((straight * roadFactor).toFixed(1));
          }
        }

        matrix.push({
          index: idx++,
          from: fromT.name,
          to: toT.name,
          distance: distKm
        });
      }
    }
    return matrix;
  }

  // Exact port of BaseballEasyScoreCalculator.java + Rich Diagnostics
  function evaluatePlan(plan, teams = window.KBO_DATA.teams, distanceMatrix = window.KBO_DATA.distanceMatrix, config = {}) {
    const childrenDayDate = (config.childrenDayStart || '2025-05-05').slice(0, 10);
    const openingDayDate = (config.matchStartDate || '2025-03-22').slice(0, 10);
    const allStarPivotDate = (config.allStarBreakDate || '2025-07-02').slice(0, 10);
    const allStarStart = (config.allStarStartDate || '2025-07-11').slice(0, 10);
    const allStarEnd = (config.allStarEndDate || '2025-07-16').slice(0, 10);
    const restDaysOfWeek = config.restDaysOfWeek || [1]; // 1 = Monday
    const childrenDayHomeTeams = new Set(config.childrenDayHomeTeams || ['두산', '키움', '한화', 'NC', '롯데']);
    const maxConsecutiveHomeAway = config.maxConsecutiveHomeAway || 3;

    const tolDistance = Number(config.toleranceTotalDistance ?? 300.0);
    const tolHoliday = Number(config.toleranceHoliday ?? 1.5);
    const tolWeekdayMove = Number(config.toleranceWeekdayMove ?? 1.5);
    const tolTotalMove = Number(config.toleranceTotalMove ?? 2.0);

    const teamMap = {};
    teams.forEach(t => { teamMap[t.name] = t; });
    const distLookup = buildDistanceLookup(teams, distanceMatrix);

    const calMap = {};
    (config.calendar || window.KBO_DATA.calendar).forEach(c => {
      calMap[c.datetime.slice(0, 10)] = c;
    });

    // Group matches by date
    const byDate = {};
    let unassignedCount = 0;

    plan.forEach((m, idx) => {
      if (!m.datetime || String(m.datetime).startsWith('2100')) {
        unassignedCount++;
        return;
      }
      const dKey = String(m.datetime).slice(0, 10);
      if (!byDate[dKey]) byDate[dKey] = [];
      byDate[dKey].push({ ...m, _idx: idx, dateKey: dKey });
    });

    const sortedDates = Object.keys(byDate).sort();

    let duplicationHardScore = 0;
    let successiveHardScore = 0;
    let minimizeShortScore = -unassignedCount;

    const violations = {
      teamDuplication: [],
      stadiumDuplication: [],
      consecutiveMismatch: [],
      specialEvents: [],
      consecutiveHomeAway: [],
      successiveMatchup: []
    };

    const prevMatchPairs = new Set();
    const visitOrderByTeam = {};
    const holidayScoreByTeam = {};
    const weekendHomeSeriesByTeam = {};
    const weekendHomeGamesByTeam = {};
    const holidayHomeGamesByTeam = {};
    const homeSeriesByTeam = {};
    const awaySeriesByTeam = {};
    const homeGamesByTeam = {};
    const awayGamesByTeam = {};
    const childrenDayHomeByTeam = {};
    const openingDayHomeByTeam = {};

    teams.forEach(t => {
      visitOrderByTeam[t.name] = [];
      holidayScoreByTeam[t.name] = 0;
      weekendHomeSeriesByTeam[t.name] = 0;
      weekendHomeGamesByTeam[t.name] = 0;
      holidayHomeGamesByTeam[t.name] = 0;
      homeSeriesByTeam[t.name] = 0;
      awaySeriesByTeam[t.name] = 0;
      homeGamesByTeam[t.name] = 0;
      awayGamesByTeam[t.name] = 0;
      childrenDayHomeByTeam[t.name] = false;
      openingDayHomeByTeam[t.name] = false;
    });

    const slotSummaries = [];

    for (const dKey of sortedDates) {
      const matchList = byDate[dKey];
      const calSlot = calMap[dKey] || {
        consecutive: matchList[0]?.consecutive || 3,
        weekend: matchList[0]?.weekend || 0,
        holiday: matchList[0]?.holiday || 0
      };
      const slotViolations = [];
      const teamSet = new Set();
      const stadiumMap = {};

      const dateObj = parseDateStr(dKey);
      const dow = dateObj.getDay();

      // Check rest day or All-Star break violation
      if (restDaysOfWeek.includes(dow) && dKey !== childrenDayDate) {
        duplicationHardScore -= 1;
        const v = { date: dKey, type: 'REST_DAY', desc: `${dKey}(${DAY_NAMES_KO[dow]}) 정기 휴식일 경기 편성 위반` };
        violations.specialEvents.push(v);
        slotViolations.push(v.desc);
      }
      if (dKey >= allStarStart && dKey <= allStarEnd) {
        duplicationHardScore -= 1;
        const v = { date: dKey, type: 'ALL_STAR_BREAK', desc: `${dKey} 올스타 브레이크 기간 경기 편성 위반` };
        violations.specialEvents.push(v);
        slotViolations.push(v.desc);
      }

      for (const m of matchList) {
        const home = m.home;
        const away = m.away;
        const stadium = m.stadiumOverride || (teamMap[home] ? teamMap[home].stadium : home);
        const consec = Number(m.consecutive || calSlot.consecutive || 3);

        // Successive matchup check (Hard 1)
        const pairKey = `${home}:${away}`;
        if (prevMatchPairs.has(pairKey)) {
          successiveHardScore -= 1;
          const v = { date: dKey, home, away, desc: `${dKey} 직전 시리즈 동일 대진 연속 편성 (${away} vs ${home})` };
          violations.successiveMatchup.push(v);
          slotViolations.push(v.desc);
        }

        teamSet.add(home);
        teamSet.add(away);
        if (!stadiumMap[stadium]) stadiumMap[stadium] = [];
        stadiumMap[stadium].push(`${away} vs ${home}`);

        if (consec !== Number(calSlot.consecutive)) {
          duplicationHardScore -= 1;
          const v = { date: dKey, home, away, desc: `${dKey} 슬롯 연전 수(${calSlot.consecutive}연전) ≠ 매치 연전 수(${consec}연전)` };
          violations.consecutiveMismatch.push(v);
          slotViolations.push(v.desc);
        }

        if (dKey === childrenDayDate && childrenDayHomeTeams.has(away)) {
          duplicationHardScore -= 1;
          const v = { date: dKey, team: away, desc: `어린이날(${dKey}) 홈 의무 구단 [${away}] 원정 배정 위반` };
          violations.specialEvents.push(v);
          slotViolations.push(v.desc);
        }

        if (dKey === childrenDayDate) childrenDayHomeByTeam[home] = true;
        if (dKey === openingDayDate) openingDayHomeByTeam[home] = true;

        // Track stats
        homeSeriesByTeam[home] = (homeSeriesByTeam[home] || 0) + 1;
        awaySeriesByTeam[away] = (awaySeriesByTeam[away] || 0) + 1;
        homeGamesByTeam[home] = (homeGamesByTeam[home] || 0) + consec;
        awayGamesByTeam[away] = (awayGamesByTeam[away] || 0) + consec;

        const wk = Number(m.weekend ?? calSlot.weekend ?? 0);
        const hol = Number(m.holiday ?? calSlot.holiday ?? 0);
        if (hol > 0) {
          holidayScoreByTeam[home] = (holidayScoreByTeam[home] || 0) + hol;
          if (wk > 0) {
            weekendHomeSeriesByTeam[home] = (weekendHomeSeriesByTeam[home] || 0) + 1;
            weekendHomeGamesByTeam[home] = (weekendHomeGamesByTeam[home] || 0) + wk * 2;
            if (hol > 2) {
              holidayHomeGamesByTeam[home] = (holidayHomeGamesByTeam[home] || 0) + (hol - 2);
            }
          } else {
            holidayHomeGamesByTeam[home] = (holidayHomeGamesByTeam[home] || 0) + hol;
          }
        }

        if (visitOrderByTeam[home]) {
          visitOrderByTeam[home].push({ date: dKey, dow: DAY_NAMES_KO[dow], dowNum: dow, hostTeam: home, opponent: away, isHome: true, stadium, consecutive: consec, weekend: wk, holiday: hol });
        }
        if (visitOrderByTeam[away]) {
          visitOrderByTeam[away].push({ date: dKey, dow: DAY_NAMES_KO[dow], dowNum: dow, hostTeam: home, opponent: home, isHome: false, stadium, consecutive: consec, weekend: wk, holiday: hol });
        }
      }

      prevMatchPairs.clear();
      for (const m of matchList) {
        prevMatchPairs.add(`${m.home}:${m.away}`);
        prevMatchPairs.add(`${m.away}:${m.home}`);
      }

      if (teamSet.size !== 10) {
        const diff = Math.abs(10 - teamSet.size);
        duplicationHardScore -= diff;
        const v = { date: dKey, count: teamSet.size, desc: `${dKey} 경기 참여 고유 구단 수 불일치 (${teamSet.size}/10개 구단)` };
        violations.teamDuplication.push(v);
        slotViolations.push(v.desc);
      }

      const stadiumKeys = Object.keys(stadiumMap);
      if (stadiumKeys.length !== 5) {
        const diff = Math.abs(5 - stadiumKeys.length);
        duplicationHardScore -= diff;
        const dupStadiums = Object.entries(stadiumMap).filter(([, arr]) => arr.length > 1).map(([st, arr]) => `${st}(${arr.join(', ')})`).join('; ');
        const v = { date: dKey, stadiumCount: stadiumKeys.length, desc: `${dKey} 구장 중복 배정 위반: ${dupStadiums || (stadiumKeys.length + '개 구장')}` };
        violations.stadiumDuplication.push(v);
        slotViolations.push(v.desc);
      }

      if (matchList.length !== 5) {
        const diff = Math.abs(5 - matchList.length);
        duplicationHardScore -= diff;
        const v = { date: dKey, matchCount: matchList.length, desc: `${dKey} 슬롯 배정 경기 수 불일치 (${matchList.length}/5경기)` };
        violations.teamDuplication.push(v);
        slotViolations.push(v.desc);
      }

      slotSummaries.push({
        date: dKey,
        dow: DAY_NAMES_KO[dow],
        consecutive: calSlot.consecutive,
        weekend: calSlot.weekend,
        holiday: calSlot.holiday,
        isOpeningDay: dKey === openingDayDate,
        isChildrenDay: dKey === childrenDayDate,
        matches: matchList,
        violations: slotViolations
      });
    }

    // Distance, Move count, and Consecutive Home/Away Streak analysis per team
    const distanceByTeam = {};
    const totalMoveByTeam = {};
    const weekdayMoveByTeam = {};
    const teamAnalyticsMap = {};

    for (const t of teams) {
      const tName = t.name;
      const visits = visitOrderByTeam[tName] || [];
      let prevHost = null;
      let prevStadium = null;
      let prevIsHome = null;
      let prevDate = null;
      let prevDowNum = null;

      let totalDist = 0.0;
      let weekdayDist = 0.0;
      let weekendDist = 0.0;
      let totalMoves = 0;
      let weekdayMoves = 0;
      let weekendMoves = 0;
      let consecStreak = 0;
      let maxHomeStreak = 0;
      let maxAwayStreak = 0;

      const monthlyDistances = { '03': 0, '04': 0, '05': 0, '06': 0, '07': 0, '08': 0 };
      const routeSteps = [];

      for (let i = 0; i < visits.length; i++) {
        const v = visits[i];
        let stepDist = 0.0;
        let moveType = '개막 고정';

        if (prevHost !== null) {
          stepDist = Number((distLookup[prevHost]?.[v.hostTeam] ?? 0.0).toFixed(1));
          totalDist = Number((totalDist + stepDist).toFixed(1));

          if (v.isHome === prevIsHome) {
            consecStreak += 1;
          } else {
            consecStreak = 1;
          }

          if (consecStreak > maxConsecutiveHomeAway) {
            duplicationHardScore -= 1;
            violations.consecutiveHomeAway.push({
              date: v.date,
              team: tName,
              type: v.isHome ? '홈' : '원정',
              streak: consecStreak,
              desc: `${tName} ${v.date} 기준 ${v.isHome ? '홈' : '원정'} ${consecStreak}연속 시리즈 편성 위반 (최대 ${maxConsecutiveHomeAway}연속)`
            });
          }

          const isAfterTuesday = (prevDowNum === 2) && (prevDate !== allStarPivotDate);
          if (stepDist > 0) {
            totalMoves += 1;
            if (isAfterTuesday) {
              weekdayMoves += 1;
              weekdayDist = Number((weekdayDist + stepDist).toFixed(1));
              moveType = '주중 이동';
            } else {
              weekendMoves += 1;
              weekendDist = Number((weekendDist + stepDist).toFixed(1));
              moveType = prevDate === allStarPivotDate ? '올스타 후 이동' : '주말 이동';
            }
          } else {
            moveType = '체류 (0km)';
          }
        } else {
          consecStreak = 1;
        }

        if (v.isHome) {
          if (consecStreak > maxHomeStreak) maxHomeStreak = consecStreak;
        } else {
          if (consecStreak > maxAwayStreak) maxAwayStreak = consecStreak;
        }

        const monthKey = v.date.slice(5, 7);
        if (monthlyDistances[monthKey] !== undefined) {
          monthlyDistances[monthKey] = Number((monthlyDistances[monthKey] + stepDist).toFixed(1));
        }

        routeSteps.push({
          stepIndex: i + 1,
          date: v.date,
          dow: v.dow,
          isHome: v.isHome,
          opponent: v.opponent,
          fromStadium: prevStadium || v.stadium,
          toStadium: v.stadium,
          path: `${prevStadium || v.stadium} → ${v.stadium}`,
          distance: stepDist,
          cumulativeDistance: totalDist,
          moveType,
          streakLabel: `${v.isHome ? '홈' : '원정'} ${consecStreak}연속`,
          consecutiveGames: v.consecutive
        });

        prevHost = v.hostTeam;
        prevStadium = v.stadium;
        prevIsHome = v.isHome;
        prevDate = v.date;
        prevDowNum = v.dowNum;
      }

      distanceByTeam[tName] = totalDist;
      totalMoveByTeam[tName] = totalMoves;
      weekdayMoveByTeam[tName] = weekdayMoves;

      teamAnalyticsMap[tName] = {
        team: tName,
        fullName: t.fullName || tName,
        stadium: t.stadium,
        city: t.city || '',
        color: t.color || '#2563EB',
        subColor: t.subColor || '#1E40AF',
        sharedStadium: !!t.sharedStadium,
        totalDistance: totalDist,
        weekdayDistance: weekdayDist,
        weekendDistance: weekendDist,
        totalMoveCount: totalMoves,
        weekdayMoveCount: weekdayMoves,
        weekendMoveCount: weekendMoves,
        weekendHomeSeries: weekendHomeSeriesByTeam[tName] || 0,
        weekendHomeGames: weekendHomeGamesByTeam[tName] || 0,
        holidayHomeGames: holidayHomeGamesByTeam[tName] || 0,
        holidayScore: holidayScoreByTeam[tName] || 0,
        homeSeriesCount: homeSeriesByTeam[tName] || 0,
        awaySeriesCount: awaySeriesByTeam[tName] || 0,
        homeGamesCount: homeGamesByTeam[tName] || 0,
        awayGamesCount: awayGamesByTeam[tName] || 0,
        maxHomeStreak,
        maxAwayStreak,
        childrenDayHome: !!childrenDayHomeByTeam[tName],
        openingDayHome: !!openingDayHomeByTeam[tName],
        monthlyDistances,
        routeSteps
      };
    }

    // Soft Scores calculation (matching BaseballEasyScoreCalculator.java)
    const sumDistance = Object.values(distanceByTeam).reduce((a, b) => a + b, 0);
    const meanDistance = Math.floor(sumDistance / 10);

    let distanceVariance = 0;
    Object.values(distanceByTeam).forEach(d => {
      const diff = Math.abs(d - meanDistance);
      const penalty = diff > tolDistance ? (diff - tolDistance) : 0;
      distanceVariance += Math.pow(penalty, 2);
    });
    const stabilizeDistanceScore = -Math.floor(distanceVariance);
    const totalDistanceScore = -Math.floor(sumDistance);

    const meanHoliday = Object.values(holidayScoreByTeam).reduce((a, b) => a + b, 0) / 10.0;
    let holidayVariance = 0;
    Object.values(holidayScoreByTeam).forEach(h => {
      let diff = Math.abs(h - meanHoliday) / tolHoliday;
      diff = Math.floor(diff);
      holidayVariance += Math.pow(diff, 2);
    });
    const stabilizeHolidayScore = -Math.floor(holidayVariance);

    const meanMove = Object.values(totalMoveByTeam).reduce((a, b) => a + b, 0) / 10.0;
    let moveVariance = 0;
    Object.values(totalMoveByTeam).forEach(mv => {
      let diff = Math.abs(mv - meanMove) / tolTotalMove;
      diff = Math.floor(diff);
      moveVariance += Math.pow(diff, 2);
    });
    const stabilizeMoveCountScore = -Math.floor(moveVariance * 100);

    const exactMeanDist = Number((sumDistance / 10.0).toFixed(1));
    const teamAnalytics = teams.map(t => {
      const item = teamAnalyticsMap[t.name];
      const distDiff = Number((item.totalDistance - exactMeanDist).toFixed(1));
      const moveDiff = Number((item.totalMoveCount - meanMove).toFixed(1));
      const holDiff = Number((item.holidayScore - meanHoliday).toFixed(1));
      return {
        ...item,
        distanceDiffFromMean: distDiff,
        withinDistanceTolerance: Math.abs(distDiff) <= tolDistance,
        moveDiffFromMean: moveDiff,
        withinMoveTolerance: Math.abs(moveDiff) <= tolTotalMove,
        holidayDiffFromMean: holDiff,
        withinHolidayTolerance: Math.abs(holDiff) <= tolHoliday
      };
    });

    const hardChecks = [
      {
        id: 'TEAM_SLOT',
        title: '1일 10구단 5경기 편성 (구단 중복 금지)',
        desc: '모든 시리즈 슬롯에 10개 구단이 중복 없이 정확히 5경기를 치러야 합니다.',
        passed: violations.teamDuplication.length === 0,
        violationCount: violations.teamDuplication.length,
        violations: violations.teamDuplication
      },
      {
        id: 'STADIUM_DUP',
        title: '구장 중복 배정 금지 (잠실 두산·LG 공동구장 분리)',
        desc: '동일 일자에 같은 구장에서 2경기 이상 열릴 수 없으며 잠실구장 홈 중복을 차단합니다.',
        passed: violations.stadiumDuplication.length === 0,
        violationCount: violations.stadiumDuplication.length,
        violations: violations.stadiumDuplication
      },
      {
        id: 'CONSECUTIVE_MATCH',
        title: '시리즈 연전 수(2·3·4연전) 슬롯 일치',
        desc: '캘린더 슬롯의 연전 수와 배정된 매치의 연전 수가 100% 일치해야 합니다.',
        passed: violations.consecutiveMismatch.length === 0,
        violationCount: violations.consecutiveMismatch.length,
        violations: violations.consecutiveMismatch
      },
      {
        id: 'SPECIAL_EVENT_REST',
        title: '개막전·어린이날 의무 홈구장 및 휴식일·올스타브레이크 준수',
        desc: '월요일 정기휴일·올스타브레이크 미개최 및 어린이날 지정 구장 홈경기를 보장합니다.',
        passed: violations.specialEvents.length === 0,
        violationCount: violations.specialEvents.length,
        violations: violations.specialEvents
      },
      {
        id: 'HOME_AWAY_STREAK',
        title: `연속 홈/원정 시리즈 제한 (최대 ${maxConsecutiveHomeAway}연속 시리즈)`,
        desc: `특정 구단이 ${maxConsecutiveHomeAway + 1}시리즈(12경기) 이상 연속 홈 또는 원정 경기를 할 수 없습니다.`,
        passed: violations.consecutiveHomeAway.length === 0,
        violationCount: violations.consecutiveHomeAway.length,
        violations: violations.consecutiveHomeAway
      },
      {
        id: 'SUCCESSIVE_MATCHUP',
        title: '동일 구단 간 연속 시리즈 맞대결 금지 (Hard 1)',
        desc: '직전 시리즈에서 맞붙은 두 구단이 다음 시리즈에서 곧바로 다시 대결할 수 없습니다.',
        passed: violations.successiveMatchup.length === 0,
        violationCount: violations.successiveMatchup.length,
        violations: violations.successiveMatchup
      }
    ];

    const totalHardViolations = Math.abs(duplicationHardScore) + Math.abs(successiveHardScore);
    const distances = teamAnalytics.map(a => a.totalDistance);
    const moves = teamAnalytics.map(a => a.totalMoveCount);

    return {
      score: {
        hard: [duplicationHardScore, successiveHardScore],
        soft: [minimizeShortScore, stabilizeMoveCountScore, stabilizeDistanceScore, stabilizeHolidayScore, totalDistanceScore],
        feasible: duplicationHardScore === 0 && successiveHardScore === 0,
        totalHardViolations,
        formatted: `[${duplicationHardScore}/${successiveHardScore}]hard/[${minimizeShortScore}/${stabilizeMoveCountScore}/${stabilizeDistanceScore}/${stabilizeHolidayScore}/${totalDistanceScore}]soft`
      },
      hardChecks,
      teamAnalytics,
      slotSummaries,
      leagueSummary: {
        totalDistance: Number(sumDistance.toFixed(1)),
        meanDistance: exactMeanDist,
        minDistance: Number(Math.min(...distances).toFixed(1)),
        maxDistance: Number(Math.max(...distances).toFixed(1)),
        maxDistanceSpread: Number((Math.max(...distances) - Math.min(...distances)).toFixed(1)),
        teamsWithinDistanceTolerance: teamAnalytics.filter(a => a.withinDistanceTolerance).length,
        meanMoveCount: Number(meanMove.toFixed(1)),
        minMoveCount: Math.min(...moves),
        maxMoveCount: Math.max(...moves),
        meanHolidayScore: Number(meanHoliday.toFixed(1)),
        totalSeriesCount: plan.length,
        totalSlotsCount: sortedDates.length
      }
    };
  }

  // Create a deliberate Hard-violation plan for testing violation detection UI
  function createViolationDemoPlan() {
    const plan = deepClone(window.KBO_DATA.initialPlan);
    // 1. Make Doosan AND LG both home at Jamsil on 2025-04-04 (index 24: Lotte->Doosan home)
    const idx24 = plan.findIndex(m => m.datetime.startsWith('2025-04-04') && m.away === '두산');
    if (idx24 !== -1) {
      const temp = plan[idx24].home;
      plan[idx24].home = plan[idx24].away; // Doosan becomes home on 2025-04-04 while LG is also home!
      plan[idx24].away = temp;
    }
    // 2. Flip Doosan to Away on Children's Day 2025-05-05 (violating Children's Day obligation)
    const idxChild = plan.findIndex(m => m.datetime.startsWith('2025-05-05') && m.home === '두산');
    if (idxChild !== -1) {
      plan[idxChild].home = 'LG';
      plan[idxChild].away = '두산';
    }
    // 3. Create a successive matchup on 2025-03-25 (LG vs Lotte again right after 2025-03-22)
    const idxSucc = plan.findIndex(m => m.datetime.startsWith('2025-03-25') && m.home === 'LG');
    const idxSucc2 = plan.findIndex(m => m.datetime.startsWith('2025-03-25') && m.away === '롯데');
    if (idxSucc !== -1 && idxSucc2 !== -1 && idxSucc !== idxSucc2) {
      const oldAway = plan[idxSucc].away;
      plan[idxSucc].away = '롯데';
      plan[idxSucc2].away = oldAway;
    }
    return plan;
  }

  return {
    DAY_NAMES_KO,
    deepClone,
    parseDateStr,
    formatDateStr,
    getDayOfWeekKo,
    haversineKm,
    geocodeLocation,
    buildDistanceLookup,
    calculateDistanceMatrixFromCoords,
    evaluatePlan,
    createViolationDemoPlan
  };
})();
